import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Provider, SearchQuery, SearchResult } from '../../interfaces/provider.interface'

/**
 * 资源论坛 Provider（通用框架）
 *
 * 通过环境变量配置目标论坛：
 *   FORUM_SITE_URL=https://forum.example.com/search?q={keyword}
 *   FORUM_TITLE_REGEX=<a[^>]*>([^<]+)</a>  # 标题正则
 *   FORUM_LINK_REGEX=href="(https?://[^"]+)"  # 链接正则
 *
 * 爬取论坛搜索页 HTML，用正则解析标题和链接。
 * 适合公开资源论坛、影视站等。
 *
 * 注意：论坛反爬严格时可能失效，需要配合 Cookie/User-Agent 伪装。
 */
@Injectable()
export class ForumProvider implements Provider {
  private readonly logger = new Logger(ForumProvider.name)
  readonly name = 'forum'
  readonly displayName = '资源论坛'
  readonly category = 'forum' as const

  private readonly siteUrl: string
  private readonly titleRegex: RegExp | null
  private readonly linkRegex: RegExp | null
  private readonly timeout: number
  private readonly cookie: string

  constructor(private readonly configService: ConfigService) {
    this.siteUrl = this.configService.get<string>('FORUM_SITE_URL', '')
    this.cookie = this.configService.get<string>('FORUM_COOKIE', '')
    this.timeout = this.configService.get<number>('FORUM_TIMEOUT', 8000)

    const titlePattern = this.configService.get<string>('FORUM_TITLE_REGEX', '')
    const linkPattern = this.configService.get<string>('FORUM_LINK_REGEX', '')
    this.titleRegex = titlePattern ? new RegExp(titlePattern, 'g') : null
    this.linkRegex = linkPattern ? new RegExp(linkPattern, 'g') : null
  }

  get enabled(): boolean {
    return !!this.siteUrl && !!this.titleRegex && !!this.linkRegex
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.enabled) return []

    try {
      const url = this.siteUrl.replace('{keyword}', encodeURIComponent(query.keyword))
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url, {
        headers: {
          Accept: 'text/html',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0',
          ...(this.cookie ? { Cookie: this.cookie } : {}),
        },
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const html = await response.text()
      return this.parseHtml(html)
    } catch (err) {
      this.logger.debug(`Forum search failed: ${(err as Error).message}`)
      return []
    }
  }

  private parseHtml(html: string): SearchResult[] {
    const results: SearchResult[] = []
    if (!this.titleRegex || !this.linkRegex) return []

    const titles = [...html.matchAll(this.titleRegex)]
    const links = [...html.matchAll(this.linkRegex)]

    // 配对标题和链接（取较短的长度）
    const count = Math.min(titles.length, links.length, 20)

    for (let i = 0; i < count; i++) {
      const title = titles[i][1]?.trim()
      const url = links[i][1]?.trim()

      if (!title || !url || !url.startsWith('http')) continue

      results.push({
        title: title.slice(0, 200),
        url,
        source: this.name,
        sourceDisplayName: this.displayName,
        category: this.category,
        resourceMeta: {
          originSource: this.extractDomain(this.siteUrl),
        },
      })
    }

    return results
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname
    } catch {
      return 'forum'
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.enabled) return false
    try {
      const response = await fetch(this.siteUrl.replace('{keyword}', 'test'), {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(5000),
      })
      return response.ok
    } catch {
      return false
    }
  }
}
