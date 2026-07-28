/**
 * @seekall/rule-pansou - 网盘资源搜索（无头浏览器渲染 CSR 网盘搜索站）
 *
 * 风险评级：L3（自用）
 * 数据源：夸克搜索 / UP云搜 / 阿里云盘搜 等 CSR 站点
 *
 * 原理：这些站搜索结果是 JS 动态渲染的，普通 fetch 拿不到。
 * 用 puppeteer-core 启动无头浏览器，渲染页面后提取搜索结果。
 * 每次搜索临时 launch 浏览器、结束即 close（4GB 服务器避免常驻吃内存）；
 * 多源并行渲染（Promise.allSettled），单源失败不阻塞其它源。
 */

import type { Rule, Hit, RuleContext } from '@seekall/sdk'
import type { Browser, Page } from 'puppeteer-core'
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'

// ─── 浏览器路径探测 ─────────────────────────────────────────

function getExecutablePath(): string {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH
  if (envPath) return envPath

  const candidates = [
    // Linux (alpine/debian)
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    // Windows
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    // macOS
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  throw new Error('找不到 Chrome/Chromium/Edge，请设置 PUPPETEER_EXECUTABLE_PATH 环境变量')
}

async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    executablePath: getExecutablePath(),
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
    ],
  })
}

// ─── 通用页面提取逻辑 ──────────────────────────────────────

/**
 * 在页面上下文中执行，提取搜索结果。
 * 策略1：通用结果卡片选择器；策略2：包含网盘域名的链接。
 */
const EXTRACT_FN = `
(() => {
  const results = []
  const seen = new Set()

  const cardSelectors = [
    '[class*="result"] [class*="item"]',
    '[class*="search"] [class*="item"]',
    '[class*="list"] > [class*="item"]',
    '[class*="card-item"]', '.result-item', '.search-item', '.list-item',
    'article',
  ].join(', ')

  document.querySelectorAll(cardSelectors).forEach(card => {
    const a = card.querySelector('a[href]')
    if (!a) return
    const href = a.href
    if (seen.has(href) || href === location.href) return
    const titleEl = card.querySelector('h2, h3, h4, .title, [class*="title"], [class*="name"]')
    const title = (titleEl || a).textContent.replace(/\\s+/g, ' ').trim().slice(0, 200)
    if (title.length < 2) return
    const snippetEl = card.querySelector('p, .desc, .summary, [class*="desc"], [class*="summary"], [class*="info"]')
    const snippet = snippetEl ? snippetEl.textContent.replace(/\\s+/g, ' ').trim().slice(0, 200) : ''
    seen.add(href)
    results.push({ title, url: href, snippet })
  })

  const panRe = /pan\\.baidu|pan\\.quark|alipan|115\\.com|weiyun|123pan|pan\\.xunlei|drive\\.google|cloud\\.189|pan\\.360/i
  document.querySelectorAll('a[href]').forEach(a => {
    const href = a.href
    if (seen.has(href)) return
    if (panRe.test(href) || panRe.test(a.textContent || '')) {
      const title = a.textContent.replace(/\\s+/g, ' ').trim().slice(0, 200) || href
      if (title.length < 2) return
      seen.add(href)
      results.push({ title, url: href, snippet: '' })
    }
  })

  return results.slice(0, 30)
})()
`

// ─── 网盘搜索源 ─────────────────────────────────────────────

interface PanSource {
  id: string
  label: string
  buildUrl(query: string): string
  waitSelector: string
  extraWait?: number
}

const PAN_SOURCES: PanSource[] = [
  {
    id: 'quark',
    label: '夸克搜索',
    buildUrl: (q) => `https://search.quark.cn/s?q=${encodeURIComponent(q)}`,
    waitSelector: '[class*="result"], [class*="card"], [class*="item"]',
    extraWait: 1500,
  },
  {
    id: 'upyunso',
    label: 'UP云搜',
    buildUrl: (q) => `https://www.upyunso.com/search?q=${encodeURIComponent(q)}`,
    waitSelector: '[class*="result"], [class*="item"], [class*="card"]',
    extraWait: 1500,
  },
  {
    id: 'alipansou',
    label: '阿里云盘搜',
    buildUrl: (q) => `https://www.alipansou.com/search?k=${encodeURIComponent(q)}`,
    waitSelector: '[class*="result"], [class*="item"], [class*="card"], .list',
    extraWait: 1500,
  },
]

// ─── 规则主体 ─────────────────────────────────────────────

const PAGE_TIMEOUT = 8_000

export const pansouRule: Rule = {
  name: '@seekall/rule-pansou',
  version: '0.1.0',
  riskLevel: 3,
  description: '网盘资源搜索（无头浏览器渲染 CSR 网盘搜索站）',

  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    ctx.logger.info(`pansou: 搜索 "${query}"，${PAN_SOURCES.length} 源并行渲染`)

    let browser: Browser
    try {
      browser = await launchBrowser()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      ctx.logger.error(`pansou: 启动浏览器失败: ${msg}`)
      return []
    }

    /** 单个源的搜索逻辑 */
    const searchSource = async (source: PanSource): Promise<Hit[]> => {
      if (ctx.signal.aborted) return []
      let page: Page | null = null
      try {
        page = await browser.newPage()
        await page.setUserAgent(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        )
        await page.setViewport({ width: 1280, height: 800 })

        const url = source.buildUrl(query)
        ctx.logger.debug(`pansou[${source.id}]: goto ${url}`)

        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: PAGE_TIMEOUT,
        })

        try {
          await page.waitForSelector(source.waitSelector, { timeout: 5000 })
        } catch {
          // 选择器超时不一定代表没结果，继续提取
        }

        if (source.extraWait) {
          await new Promise((r) => setTimeout(r, source.extraWait))
        }

        const raw = (await page.evaluate(EXTRACT_FN)) as Array<{
          title: string
          url: string
          snippet: string
        }>

        const hits: Hit[] = raw.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet || undefined,
          source: source.label,
          meta: { category: 'pan' as const, panSource: source.id },
        }))

        ctx.logger.debug(`pansou[${source.id}]: ${hits.length} 条`)
        return hits
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (!msg.includes('aborted')) {
          ctx.logger.warn(`pansou[${source.id}] 失败: ${msg}`)
        }
        return []
      } finally {
        if (page) {
          try { await page.close() } catch { /* ignore */ }
        }
      }
    }

    try {
      // 并行跑所有源
      const settled = await Promise.allSettled(
        PAN_SOURCES.map((s) => searchSource(s)),
      )
      const allHits: Hit[] = []
      for (const s of settled) {
        if (s.status === 'fulfilled') allHits.push(...s.value)
      }

      // 去重
      const seen = new Set<string>()
      const deduped = allHits.filter((h) => {
        const key = h.url.replace(/\/$/, '')
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      ctx.logger.info(`pansou: 共 ${deduped.length} 条去重结果`)
      return deduped
    } finally {
      try { await browser.close() } catch { /* ignore */ }
    }
  },
}

export default pansouRule
