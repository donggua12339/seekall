import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Provider, SearchQuery, SearchResult } from '../../interfaces/provider.interface'

/**
 * 资源论坛 Provider（多站点通用框架）
 *
 * 配置方式（环境变量 FORUM_SITES，JSON 数组）：
 *   FORUM_SITES=[
 *     {
 *       "name": "v2ex",
 *       "url": "https://www.v2ex.com/api/topics/search.json?q={keyword}",
 *       "type": "json",
 *       "titleField": "title",
 *       "urlField": "url",
 *       "category": "forum"
 *     },
 *     {
 *       "name": "reddit",
 *       "url": "https://www.reddit.com/search.json?q={keyword}&limit=20",
 *       "type": "reddit",
 *       "category": "forum"
 *     }
 *   ]
 *
 * 支持的类型：
 *   - json: 通用 JSON API，用 titleField/urlField 提取
 *   - reddit: Reddit 特定 JSON 格式（data.children[].data）
 *   - rss: RSS/Atom XML，解析 <item><title>/<link>
 *   - html: HTML 页面，用 titleRegex/linkRegex 正则提取
 *
 * 每个站点独立超时，单站点失败不影响其他。
 * 论坛爬虫法律风险较高，建议只配置白名单站点 + 关键词过滤。
 */
interface ForumSiteConfig {
  name: string
  url: string
  type: 'json' | 'reddit' | 'rss' | 'html'
  titleField?: string
  urlField?: string
  titleRegex?: string
  linkRegex?: string
  category?: string
  cookie?: string
  timeout?: number
}

@Injectable()
export class ForumProvider implements Provider {
  private readonly logger = new Logger(ForumProvider.name)
  readonly name = 'forum'
  readonly displayName = '资源论坛'
  readonly category = 'forum' as const

  private readonly sites: ForumSiteConfig[]
  private readonly defaultTimeout: number
  private readonly globalCookie: string

  constructor(private readonly configService: ConfigService) {
    this.defaultTimeout = this.configService.get<number>('FORUM_TIMEOUT', 6000)
    this.globalCookie = this.configService.get<string>('FORUM_COOKIE', '')

    const sitesJson = this.configService.get<string>('FORUM_SITES', '[]')
    try {
      this.sites = JSON.parse(sitesJson) as ForumSiteConfig[]
    } catch (err) {
      this.logger.error(`Failed to parse FORUM_SITES: ${(err as Error).message}`)
      this.sites = []
    }
  }

  get enabled(): boolean {
    return this.sites.length > 0
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.enabled) return []

    // 并发搜索所有站点
    const results = await Promise.allSettled(this.sites.map((site) => this.searchSite(site, query)))

    const merged: SearchResult[] = []
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        merged.push(...r.value)
        this.logger.log(`Forum ${this.sites[i].name}: ${r.value.length} results`)
      } else {
        this.logger.warn(`Forum ${this.sites[i].name} failed: ${(r.reason as Error).message}`)
      }
    })

    return merged
  }

  private async searchSite(site: ForumSiteConfig, query: SearchQuery): Promise<SearchResult[]> {
    const url = site.url.replace('{keyword}', encodeURIComponent(query.keyword))
    const timeout = site.timeout || this.defaultTimeout
    const cookie = site.cookie || this.globalCookie

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        headers: {
          Accept:
            site.type === 'html' || site.type === 'rss'
              ? 'text/html, application/xml'
              : 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0',
          ...(cookie ? { Cookie: cookie } : {}),
        },
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const text = await response.text()

      switch (site.type) {
        case 'json':
          return this.parseJson(text, site)
        case 'reddit':
          return this.parseReddit(text, site)
        case 'rss':
          return this.parseRss(text, site)
        case 'html':
          return this.parseHtml(text, site)
        default:
          return []
      }
    } catch (err) {
      this.logger.debug(`Forum ${site.name} search failed: ${(err as Error).message}`)
      return []
    }
  }

  /**
   * 通用 JSON 解析（用 titleField/urlField 提取）
   * titleField 支持 dot 路径：data.children.0.data.title
   */
  private parseJson(text: string, site: ForumSiteConfig): SearchResult[] {
    const results: SearchResult[] = []
    try {
      const data = JSON.parse(text)
      const items = this.extractArray(data, site.titleField || '', site.urlField || '')
      for (const item of items) {
        if (!item.title || !item.url) continue
        results.push({
          title: String(item.title).slice(0, 200),
          url: item.url,
          source: this.name,
          sourceDisplayName: `${this.displayName} - ${site.name}`,
          category: (site.category as 'forum' | 'netdisk' | 'magnet' | 'tg') || 'forum',
          resourceMeta: { originSource: site.name },
        })
      }
    } catch (err) {
      this.logger.debug(`Forum ${site.name} JSON parse failed: ${(err as Error).message}`)
    }
    return results
  }

  /**
   * Reddit 特定解析
   */
  private parseReddit(text: string, site: ForumSiteConfig): SearchResult[] {
    const results: SearchResult[] = []
    try {
      const data = JSON.parse(text) as {
        data?: {
          children?: Array<{
            data?: {
              title?: string
              url?: string
              permalink?: string
              subreddit?: string
              score?: number
            }
          }>
        }
      }
      const children = data.data?.children || []
      for (const c of children) {
        const d = c.data
        if (!d?.title || !d?.url) continue
        // 只保留外部链接（Reddit 自身链接跳过）
        if (d.url.startsWith('https://www.reddit.com/r/')) continue
        results.push({
          title: d.title,
          url: d.url,
          source: this.name,
          sourceDisplayName: `${this.displayName} - r/${d.subreddit || site.name}`,
          category: (site.category as 'forum' | 'netdisk' | 'magnet' | 'tg') || 'forum',
          resourceMeta: {
            originSource: `reddit/${d.subreddit || ''}`,
            score: d.score || 0,
            detailUrl: d.permalink ? `https://www.reddit.com${d.permalink}` : null,
          },
        })
      }
    } catch (err) {
      this.logger.debug(`Forum ${site.name} Reddit parse failed: ${(err as Error).message}`)
    }
    return results
  }

  /**
   * RSS/Atom XML 解析
   */
  private parseRss(text: string, site: ForumSiteConfig): SearchResult[] {
    const results: SearchResult[] = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match: RegExpExecArray | null
    while ((match = itemRegex.exec(text)) !== null) {
      const itemXml = match[1]
      const title = this.extractXmlTag(itemXml, 'title')
      const link = this.extractXmlTag(itemXml, 'link')
      if (!title || !link) continue
      results.push({
        title,
        url: link,
        source: this.name,
        sourceDisplayName: `${this.displayName} - ${site.name}`,
        category: (site.category as 'forum' | 'netdisk' | 'magnet' | 'tg') || 'forum',
        resourceMeta: { originSource: site.name },
      })
    }
    return results
  }

  /**
   * HTML 解析（正则提取）
   */
  private parseHtml(text: string, site: ForumSiteConfig): SearchResult[] {
    const results: SearchResult[] = []
    if (!site.titleRegex || !site.linkRegex) return results

    const titleRegex = new RegExp(site.titleRegex, 'g')
    const linkRegex = new RegExp(site.linkRegex, 'g')
    const titles = [...text.matchAll(titleRegex)]
    const links = [...text.matchAll(linkRegex)]

    const count = Math.min(titles.length, links.length, 20)
    for (let i = 0; i < count; i++) {
      const title = titles[i][1]?.trim()
      const url = links[i][1]?.trim()
      if (!title || !url || !url.startsWith('http')) continue
      results.push({
        title: title.slice(0, 200),
        url,
        source: this.name,
        sourceDisplayName: `${this.displayName} - ${site.name}`,
        category: (site.category as 'forum' | 'netdisk' | 'magnet' | 'tg') || 'forum',
        resourceMeta: { originSource: site.name },
      })
    }
    return results
  }

  /**
   * 从 JSON 数据中提取数组（用 titleField/urlField 路径）
   */
  private extractArray(
    data: unknown,
    titleField: string,
    urlField: string,
  ): Array<{ title: string; url: string }> {
    // 找到包含 title 和 url 的数组
    const arrays = this.findArrays(data)
    for (const arr of arrays) {
      if (Array.isArray(arr) && arr.length > 0 && typeof arr[0] === 'object') {
        const items = arr.map((item) => ({
          title: this.getPath(item, titleField),
          url: this.getPath(item, urlField),
        }))
        if (items.some((i) => i.title && i.url)) {
          return items
            .filter((i) => i.title && i.url)
            .map((i) => ({ title: String(i.title), url: String(i.url) }))
        }
      }
    }
    return []
  }

  private findArrays(data: unknown, depth = 0): unknown[][] {
    if (depth > 5) return []
    const result: unknown[][] = []
    if (Array.isArray(data)) {
      result.push(data)
      for (const item of data) {
        result.push(...this.findArrays(item, depth + 1))
      }
    } else if (data && typeof data === 'object') {
      for (const v of Object.values(data as Record<string, unknown>)) {
        result.push(...this.findArrays(v, depth + 1))
      }
    }
    return result
  }

  private getPath(obj: unknown, path: string): unknown {
    if (!path) return undefined
    const parts = path.split('.')
    let current: unknown = obj
    for (const p of parts) {
      if (current == null) return undefined
      if (Array.isArray(current)) {
        current = current[0]?.[p]
      } else if (typeof current === 'object') {
        current = (current as Record<string, unknown>)[p]
      } else {
        return undefined
      }
    }
    return current
  }

  private extractXmlTag(xml: string, tag: string): string | null {
    const regex = new RegExp(
      `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`,
      'i',
    )
    const match = xml.match(regex)
    return match?.[1] ?? match?.[2] ?? null
  }

  async healthCheck(): Promise<boolean> {
    if (!this.enabled) return false
    // 检查第一个站点
    const site = this.sites[0]
    try {
      const response = await fetch(site.url.replace('{keyword}', 'test'), {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    } catch {
      return false
    }
  }
}
