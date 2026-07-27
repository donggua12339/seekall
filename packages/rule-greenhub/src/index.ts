/**
 * @seekall/rule-greenhub - 全网绿色资源聚合搜索（自用）
 *
 * 多源并行搜索，覆盖：绿色软件 / 游戏资源 / 动漫 / 网盘搜索
 * 单源失败不影响整体结果。
 *
 * 示例：
 * ```ts
 * import { createEngine } from '@seekall/sdk'
 * import greenhub from '@seekall/rule-greenhub'
 *
 * const engine = createEngine({ rules: [greenhub] })
 * const hits = await engine.search('ATRI 我的机器人女友')
 * ```
 */

import type { Rule, Hit, RuleContext } from '@seekall/sdk'
import * as cheerio from 'cheerio'
import { fetch as ufetch, ProxyAgent } from 'undici'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { loadPool, ProxyPool, type ProxyEntry } from '@seekall/proxy-pool'

// ─── 通用工具 ───────────────────────────────────────────────

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

/** 单源整体超时 ms（含直连 + 代理重试），硬上限，到点强制返回 */
const SOURCE_TIMEOUT = 12_000
/** 直连超时（短，失败尽快转代理） */
const DIRECT_TIMEOUT = 4_000
/** 单个代理尝试超时 */
const PROXY_TIMEOUT = 4_000
/** 最多尝试几个代理（多了会拖慢整体，免费代理死亡率高） */
const MAX_PROXY_ATTEMPTS = 2
/** 代理池缓存 TTL（到期重读文件，拿到刷新后的代理） */
const POOL_TTL = 5 * 60 * 1000

// ─── 代理池（TTL 缓存，定期重读文件）─────────────────────────

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

const REQ_HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
}

/** 硬超时兜底：无论内部 promise 是否挂死（如 SOCKS 连接阶段 abort 不 settle），到点必返回 fallback。 */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    p.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      () => {
        clearTimeout(timer)
        resolve(fallback)
      },
    )
  })
}

/**
 * 抓取 HTML：先直连（短超时），失败则走大陆代理故障转移。
 * 用于救活从 HK 访问被墙/超时的国内源（如果核剥壳）。
 */
async function fetchHtml(
  url: string,
  outerSignal: AbortSignal,
  pool: ProxyPool | null,
  logger: RuleContext['logger'],
  sourceId: string,
): Promise<string> {
  const headers = { ...REQ_HEADERS, Referer: new URL(url).origin + '/' }

  // 1. 直连
  try {
    const res = await fetch(url, {
      signal: AbortSignal.any([outerSignal, AbortSignal.timeout(DIRECT_TIMEOUT)]),
      headers,
      redirect: 'follow',
    })
    if (res.ok) return await res.text()
    throw new Error(`HTTP ${res.status}`)
  } catch (err) {
    if (outerSignal.aborted) throw err
    // 直连失败，落到代理
  }

  // 2. 大陆代理故障转移（支持 http/https/socks4/socks5）
  if (pool) {
    for (let i = 0; i < MAX_PROXY_ATTEMPTS; i++) {
      if (outerSignal.aborted) break
      const entry = pool.pick('cn')
      if (!entry) break
      const key = `${entry.host}:${entry.port}`
      // 单次尝试信号：源级取消 + 单次超时，两者任一触发即中止
      const attemptSignal = AbortSignal.any([outerSignal, AbortSignal.timeout(PROXY_TIMEOUT)])
      try {
        const text = await fetchViaProxy(entry, url, headers, attemptSignal)
        pool.reportSuccess(key)
        logger.debug(`greenhub[${sourceId}]: 代理 ${entry.protocol}://${key} 救活`)
        return text
      } catch (err) {
        pool.reportFailure(key)
        if (outerSignal.aborted) throw err
      }
    }
  }

  throw new Error('直连与代理均失败')
}

/** 通过指定代理抓取 URL（按协议分发：http/https 走 undici，socks 走 socks-proxy-agent）。 */
async function fetchViaProxy(
  entry: ProxyEntry,
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<string> {
  if (entry.protocol === 'socks4' || entry.protocol === 'socks5') {
    return fetchViaSocks(entry, url, headers, signal)
  }
  const dispatcher = new ProxyAgent({
    uri: `http://${entry.host}:${entry.port}`,
    connectTimeout: PROXY_TIMEOUT,
  })
  try {
    const res = await ufetch(url, { dispatcher, signal, headers, redirect: 'follow' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    await dispatcher.close().catch(() => {})
  }
}

/** SOCKS 代理抓取（node http/https + socks-proxy-agent）。 */
function fetchViaSocks(
  entry: ProxyEntry,
  url: string,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error('aborted'))
    const scheme = entry.protocol === 'socks5' ? 'socks5' : 'socks4'
    const agent = new SocksProxyAgent(`${scheme}://${entry.host}:${entry.port}`)
    const reqFn = url.startsWith('https') ? httpsRequest : httpRequest
    const req = reqFn(url, { agent, headers }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c: Buffer) => chunks.push(c))
      res.on('end', () => {
        const status = res.statusCode || 0
        if (status >= 200 && status < 400) resolve(Buffer.concat(chunks).toString('utf-8'))
        else reject(new Error(`HTTP ${status}`))
      })
    })
    const onAbort = () => {
      req.destroy()
      reject(new Error('aborted'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    req.on('error', reject)
    req.on('close', () => signal.removeEventListener('abort', onAbort))
    req.end()
  })
}

function strip(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── 数据源接口 ─────────────────────────────────────────────

interface Source {
  id: string
  label: string
  category: 'software' | 'game' | 'anime' | 'pan' | 'general'
  buildUrl(query: string): string
  parse(html: string): Hit[]
}

// ─── WordPress 通用解析器 ───────────────────────────────────

function wpParse(source: string, maxItems = 15) {
  return (html: string): Hit[] => {
    const $ = cheerio.load(html)
    const hits: Hit[] = []

    // 覆盖常见 WP 主题的搜索结果容器
    const containers = [
      'article',
      '.post',
      '.post-item',
      '.card-item',
      '.entry',
      'li.item',
      '.search-item',
      '.content-list li',
    ].join(', ')

    $(containers).each((_, el) => {
      const $el = $(el)
      const $a = $el
        .find('h2 a, h3 a, .post-title a, .entry-title a, a.title, h4 a')
        .first()
      if (!$a.length) return

      const title = $a.text().trim()
      let url = $a.attr('href') || ''
      if (!title || !url) return

      // 补全相对路径
      if (url.startsWith('/')) {
        url = new URL(url, `https://${source}`).href
      }

      const snippet = strip(
        $el.find('.entry-content, .post-content, .entry-summary, .excerpt, .desc, p').first().html() || '',
      ).slice(0, 200)

      hits.push({
        title,
        url,
        snippet: snippet || undefined,
        source,
        meta: { category: undefined },
      })
    })

    return hits.slice(0, maxItems)
  }
}

// ─── 数据源列表 ─────────────────────────────────────────────

const SOURCES: Source[] = [
  // ═══ 绿色软件 ═══
  {
    id: 'ghxi',
    label: '果核剥壳',
    category: 'software',
    buildUrl: (q) => `https://www.ghxi.com/?s=${encodeURIComponent(q)}`,
    parse: wpParse('ghxi.com'),
  },
  {
    id: '423down',
    label: '423down',
    category: 'software',
    buildUrl: (q) => `https://www.423down.com/?s=${encodeURIComponent(q)}`,
    parse: wpParse('423down.com'),
  },
  {
    id: 'mpyit',
    label: '殁漂遥',
    category: 'software',
    buildUrl: (q) => `https://www.mpyit.com/?s=${encodeURIComponent(q)}`,
    parse: wpParse('mpyit.com'),
  },
  {
    id: 'isharepc',
    label: '乐软',
    category: 'software',
    buildUrl: (q) => `https://www.isharepc.com/?s=${encodeURIComponent(q)}`,
    parse: wpParse('isharepc.com'),
  },
  {
    id: 'appinn',
    label: '小众软件',
    category: 'software',
    buildUrl: (q) => `https://www.appinn.com/?s=${encodeURIComponent(q)}`,
    parse: wpParse('appinn.com'),
  },

  // ═══ 游戏 / Galgame ═══
  {
    id: 'acgbns',
    label: 'ACGBNS',
    category: 'game',
    buildUrl: (q) => `https://acgbns.com/?s=${encodeURIComponent(q)}`,
    parse: wpParse('acgbns.com'),
  },
  {
    id: 'yxssp',
    label: '游戏SSP',
    category: 'game',
    buildUrl: (q) => `https://www.yxssp.com/?s=${encodeURIComponent(q)}`,
    parse: wpParse('yxssp.com'),
  },
  {
    id: 'naodai',
    label: '脑洞',
    category: 'general',
    buildUrl: (q) => `https://www.naodai.org/?s=${encodeURIComponent(q)}`,
    parse: wpParse('naodai.org'),
  },

  // ═══ 动漫 / 二次元 ═══
  {
    id: 'dmhy',
    label: '动漫花园',
    category: 'anime',
    buildUrl: (q) => `https://share.dmhy.org/topics/list?keyword=${encodeURIComponent(q)}`,
    parse: (html): Hit[] => {
      const $ = cheerio.load(html)
      const hits: Hit[] = []
      $('table tbody tr, .topic_list tr').each((_, el) => {
        const $el = $(el)
        const $a = $el.find('td.title a, .title a').first()
        if (!$a.length) return
        const title = $a.text().trim()
        let url = $a.attr('href') || ''
        if (!title || !url) return
        if (url.startsWith('/')) url = `https://share.dmhy.org${url}`
        const size = $el.find('td:nth-child(5)').text().trim()
        hits.push({
          title,
          url,
          snippet: size ? `大小: ${size}` : undefined,
          source: 'share.dmhy.org',
          meta: { category: 'anime' },
        })
      })
      return hits.slice(0, 20)
    },
  },
  {
    id: 'mikan',
    label: '蜜柑计划',
    category: 'anime',
    buildUrl: (q) => `https://mikanani.me/Home/Search?searchstr=${encodeURIComponent(q)}`,
    parse: (html): Hit[] => {
      const $ = cheerio.load(html)
      const hits: Hit[] = []
      $('.an-ul li, .js-search-results-row, .mikan-section li').each((_, el) => {
        const $el = $(el)
        const $a = $el.find('a').first()
        if (!$a.length) return
        const title = $a.text().trim() || $a.attr('title') || ''
        let url = $a.attr('href') || ''
        if (!title || !url) return
        if (url.startsWith('/')) url = `https://mikanani.me${url}`
        hits.push({
          title,
          url,
          snippet: $el.find('.an-info, .subtitle').text().trim() || undefined,
          source: 'mikanani.me',
          meta: { category: 'anime' },
        })
      })
      return hits.slice(0, 20)
    },
  },

  // ═══ 综合 / 工具 ═══
  {
    id: 'iplaysoft',
    label: '异次元软件',
    category: 'software',
    buildUrl: (q) => `https://www.iplaysoft.com/?s=${encodeURIComponent(q)}`,
    parse: wpParse('iplaysoft.com'),
  },
]

// ─── 规则主体 ─────────────────────────────────────────────

export const greenhubRule: Rule = {
  name: '@seekall/rule-greenhub',
  version: '0.1.0',
  riskLevel: 3,
  description:
    '全网绿色资源聚合搜索（自用）：绿色软件/游戏/动漫/综合，11 源并行',

  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    ctx.logger.info(`greenhub: 搜索 "${query}"，${SOURCES.length} 源并行`)

    const pool = await getFreshPool()
    if (pool) {
      const s = pool.stats()
      ctx.logger.info(`greenhub: 代理池 ${s.total} 个（大陆 ${s.cn} / 海外 ${s.foreign}）`)
    } else {
      ctx.logger.warn('greenhub: 无可用代理池，仅直连')
    }

    const tasks = SOURCES.map((source): Promise<Hit[]> => {
      // 硬超时兜底：即使内部（如 SOCKS）挂死，到 SOURCE_TIMEOUT 也强制返回 []
      return withTimeout(
        (async (): Promise<Hit[]> => {
      // 每源独立 AbortController + 超时
      const ac = new AbortController()
      ctx.signal.addEventListener('abort', () => ac.abort(), { once: true })
      const timer = setTimeout(() => ac.abort(), SOURCE_TIMEOUT)

      try {
        const url = source.buildUrl(query)
        ctx.logger.debug(`greenhub[${source.id}]: GET ${url}`)
        const html = await fetchHtml(url, ac.signal, pool, ctx.logger, source.id)
        const hits = source.parse(html)
        // 填充 meta.category
        for (const h of hits) {
          if (!h.meta) h.meta = {}
          h.meta.category = source.category
        }
        ctx.logger.debug(`greenhub[${source.id}]: ${hits.length} 条`)
        return hits
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg !== 'This operation was aborted') {
          ctx.logger.warn(`greenhub[${source.id}] 失败: ${msg}`)
        }
        return []
      } finally {
        clearTimeout(timer)
      }
        })(),
        SOURCE_TIMEOUT,
        [] as Hit[],
      )
    })

    const settled = await Promise.allSettled(tasks)

    const results: Hit[] = []
    let failCount = 0
    for (const s of settled) {
      if (s.status === 'fulfilled') {
        results.push(...s.value)
      } else {
        failCount++
      }
    }

    // 按 url 去重
    const seen = new Set<string>()
    const deduped = results.filter((hit) => {
      const key = hit.url.replace(/\/$/, '')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    ctx.logger.info(
      `greenhub: 完成 | ${deduped.length} 条结果 | ${failCount} 源失败`,
    )
    return deduped
  },
}

export default greenhubRule
