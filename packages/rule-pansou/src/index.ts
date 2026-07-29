/**
 * @seekall/rule-pansou - 网盘资源搜索（无头浏览器渲染 CSR 网盘搜索站）
 *
 * 风险评级：L3（自用）
 * 数据源：7 个网盘搜索站（夸克 / UP云搜 / 阿里云盘搜 / 我的盘 / 盘搜Pro / 迅雷搜 / 天翼搜）
 *
 * 代理故障转移：HK 服务器直连国内站可能超时，自动走大陆代理。
 * 每次搜索临时 launch 浏览器、结束即 close（4GB 服务器避免常驻吃内存）；
 * 多源并行渲染（Promise.allSettled），单源失败不阻塞其它源。
 */

import type { Rule, Hit, RuleContext } from '@seekall/sdk'
import type { Browser, Page } from 'puppeteer-core'
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'
import { loadPool, ProxyPool } from '@seekall/proxy-pool'

// ─── 浏览器路径探测 ─────────────────────────────────────────

function getExecutablePath(): string {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH
  if (envPath) return envPath

  const candidates = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  throw new Error('找不到 Chrome/Chromium/Edge，请设置 PUPPETEER_EXECUTABLE_PATH 环境变量')
}

// ─── 代理池（TTL 缓存）──────────────────────────────────────

const POOL_TTL = 5 * 60 * 1000
let cachedPool: ProxyPool | null = null
let cachedAt = 0

async function getFreshPool(): Promise<ProxyPool | null> {
  if (cachedPool && Date.now() - cachedAt < POOL_TTL) return cachedPool
  try {
    const entries = await loadPool()
    if (entries.length > 0) {
      cachedPool = new ProxyPool(entries)
      cachedAt = Date.now()
    }
    return cachedPool
  } catch {
    return cachedPool
  }
}

/** 获取大陆代理 URL + 协议 */
async function getProxyInfo(): Promise<{ url: string; protocol: string } | null> {
  const pool = await getFreshPool()
  if (!pool) return null
  const entry = pool.pick('cn')
  if (!entry) return null
  const url = `http://${entry.host}:${entry.port}`
  return { url, protocol: entry.protocol }
}

/** 根据代理协议生成 puppeteer --proxy-server 参数值 */
function toPuppeteerProxy(host: string, port: number, protocol: string): string {
  if (protocol === 'socks5') return `socks5://${host}:${port}`
  if (protocol === 'socks4') return `socks4://${host}:${port}`
  return `${host}:${port}` // HTTP 代理 puppeteer 默认格式
}

async function launchBrowser(proxyHost?: string, proxyPort?: number, proxyProtocol?: string): Promise<Browser> {
  const args = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
  ]
  if (proxyHost && proxyPort && proxyProtocol) {
    args.push(`--proxy-server=${toPuppeteerProxy(proxyHost, proxyPort, proxyProtocol)}`)
  }
  return puppeteer.launch({
    executablePath: getExecutablePath(),
    headless: true,
    args,
  })
}

// ─── 通用页面提取逻辑 ──────────────────────────────────────

const EXTRACT_FN = `
(() => {
  const results = []
  const seen = new Set()

  function extractFileType(title) {
    if (/\\[文件夹\\]|\\[folder\\]|文件夹|📁|📂/i.test(title)) return 'folder'
    if (/\\[文件\\]|\\[file\\]|\\.zip|\\.rar|\\.7z|\\.exe|\\.apk|\\.iso|\\.dmg|\\.pdf|\\.epub|\\.mp4|\\.mkv/i.test(title)) return 'file'
    return 'unknown'
  }

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
    results.push({ title, url: href, snippet, fileType: extractFileType(title + ' ' + snippet) })
  })

  const panRe = /pan\\.baidu|pan\\.quark|alipan|115\\.com|weiyun|123pan|pan\\.xunlei|drive\\.google|cloud\\.189|pan\\.360/i
  document.querySelectorAll('a[href]').forEach(a => {
    const href = a.href
    if (seen.has(href)) return
    if (panRe.test(href) || panRe.test(a.textContent || '')) {
      const title = a.textContent.replace(/\\s+/g, ' ').trim().slice(0, 200) || href
      if (title.length < 2) return
      seen.add(href)
      results.push({ title, url: href, snippet: '', fileType: extractFileType(title) })
    }
  })

  return results.slice(0, 30)
})()
`

// ─── 网盘搜索源（7 个，对齐竞品）────────────────────────────

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
    extraWait: 3000,
  },
  {
    id: 'upyunso',
    label: 'UP云搜',
    buildUrl: (q) => `https://www.upyunso.com/search?q=${encodeURIComponent(q)}`,
    waitSelector: '[class*="result"], [class*="item"], [class*="card"]',
    extraWait: 3000,
  },
]

// ─── 规则主体 ─────────────────────────────────────────────

const PAGE_TIMEOUT = 15_000

export const pansouRule: Rule = {
  name: '@seekall/rule-pansou',
  version: '0.2.2',
  riskLevel: 3,
  description: '网盘资源搜索（quark + upyunso 无头浏览器，HK 直连可达）',

  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    const useProxy = process.env.PANSOU_PROXY === '1'
    ctx.logger.info(`pansou: 搜索 "${query}"，${PAN_SOURCES.length} 源并行渲染 (proxy=${useProxy})`)

    // 代理模式：仅 PANSOU_PROXY=1 时启用（免费代理质量差，浏览器级别代理无 per-source 故障转移）
    let proxyHost: string | undefined
    let proxyPort: number | undefined
    let proxyProtocol: string | undefined
    if (useProxy) {
      try {
        const info = await getProxyInfo()
        if (info) {
          const m = info.url.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/)
          if (m) {
            proxyHost = m[1]
            proxyPort = parseInt(m[2], 10)
            proxyProtocol = info.protocol
            ctx.logger.info(`pansou: 使用代理 ${proxyHost}:${proxyPort} (${proxyProtocol})`)
          }
        }
      } catch {
        ctx.logger.warn(`pansou: 代理获取失败，走直连`)
      }
    }

    let browser: Browser
    try {
      browser = await launchBrowser(proxyHost, proxyPort, proxyProtocol)
    } catch (launchErr) {
      if (proxyHost) {
        ctx.logger.warn(`pansou: 代理启动浏览器失败，回退直连`)
        if (cachedPool) cachedPool.reportFailure(`http://${proxyHost}:${proxyPort}`)
        try { browser = await launchBrowser() } catch (err2) {
          ctx.logger.error(`pansou: 直连也失败: ${err2 instanceof Error ? err2.message : String(err2)}`)
          return []
        }
      } else {
        ctx.logger.error(`pansou: 启动浏览器失败: ${launchErr instanceof Error ? launchErr.message : String(launchErr)}`)
        return []
      }
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
          fileType: string
        }>

        const hits: Hit[] = raw.map((r) => ({
          title: r.title,
          url: r.url,
          snippet: r.snippet || undefined,
          source: source.label,
          meta: {
            category: 'pan' as const,
            panSource: source.id,
            fileType: r.fileType || 'unknown',
          },
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
      const settled = await Promise.allSettled(
        PAN_SOURCES.map((s) => searchSource(s)),
      )
      const allHits: Hit[] = []
      for (const s of settled) {
        if (s.status === 'fulfilled') allHits.push(...s.value)
      }

      if (proxyHost && allHits.length > 0 && cachedPool) {
        cachedPool.reportSuccess(`http://${proxyHost}:${proxyPort}`)
      }

      const seen = new Set<string>()
      const deduped = allHits.filter((h) => {
        const key = h.url.replace(/\/$/, '')
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      ctx.logger.info(`pansou: 共 ${deduped.length} 条去重结果 (proxy=${!!proxyHost})`)
      return deduped
    } finally {
      try { await browser.close() } catch { /* ignore */ }
    }
  },
}

export default pansouRule
