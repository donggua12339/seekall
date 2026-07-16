import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Provider, SearchQuery, SearchResult } from '../../interfaces/provider.interface'

/**
 * BT4G 磁力搜索 Provider
 * 文档参考：https://docs.searxng.org/dev/engines/online/bt4g.html
 *
 * 接口：GET https://bt4gprx.com/search?q={keyword}&orderby={order}&category={cat}&p={page}&page=rss
 * 返回 RSS/XML 格式，字段：
 *   <title> - 标题
 *   <guid> - 详情页 URL
 *   <link> - 磁力链接
 *   <description> - 包含文件大小（按 <br> 分割取索引 1）
 *   <pubDate> - 发布时间
 */
@Injectable()
export class MagnetProvider implements Provider {
  private readonly logger = new Logger(MagnetProvider.name)
  readonly name = 'magnet'
  readonly displayName = '磁力资源'
  readonly category = 'magnet' as const

  private readonly baseUrl: string
  private readonly timeout: number

  constructor(private readonly configService: ConfigService) {
    // bt4g 的镜像域名，可通过环境变量覆盖（防止主域名被墙）
    this.baseUrl = this.configService.get<string>('MAGNET_SITE_URL', 'https://bt4gprx.com')
    this.timeout = this.configService.get<number>('MAGNET_TIMEOUT', 5000)
  }

  get enabled(): boolean {
    // bt4g 国内被墙，默认禁用
    // 需要时在 .env 设置 MAGNET_ENABLED=true + 可达的 MAGNET_SITE_URL
    return (
      this.baseUrl !== '' && this.configService.get<string>('MAGNET_ENABLED', 'false') === 'true'
    )
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.enabled) return []

    try {
      const url = new URL('/search', this.baseUrl)
      url.searchParams.set('q', query.keyword)
      url.searchParams.set('orderby', 'relevance')
      url.searchParams.set('category', 'all')
      url.searchParams.set('p', String(query.page || 1))
      url.searchParams.set('page', 'rss')

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/rss+xml, application/xml, text/xml',
          'User-Agent': 'SeekAll/0.1.0',
        },
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const xml = await response.text()
      return this.parseRss(xml)
    } catch (err) {
      this.logger.warn(`Magnet search failed: ${(err as Error).message}`)
      return []
    }
  }

  /**
   * 解析 RSS XML 响应
   * BT4G 的 RSS 格式标准，用正则提取 <item> 节点
   */
  private parseRss(xml: string): SearchResult[] {
    const results: SearchResult[] = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match: RegExpExecArray | null

    while ((match = itemRegex.exec(xml)) !== null) {
      const itemXml = match[1]
      const title = this.extractTag(itemXml, 'title')
      const guid = this.extractTag(itemXml, 'guid')
      const link = this.extractTag(itemXml, 'link')
      const description = this.extractTag(itemXml, 'description')
      const pubDate = this.extractTag(itemXml, 'pubDate')

      if (!title || !link) continue

      // 磁力链接必须以 magnet: 开头
      if (!link.startsWith('magnet:')) continue

      // 从 description 提取文件大小（按 <br> 分割取索引 1）
      const fileSize = this.parseFileSize(description)
      // 从磁力链接提取 magnet hash 作为唯一标识
      const hashMatch = link.match(/xt=urn:btih:([a-zA-Z0-9]+)/i)
      const magnetHash = hashMatch?.[1]

      results.push({
        title,
        url: link, // 磁力链接直接作为 URL
        source: this.name,
        sourceDisplayName: this.displayName,
        category: this.category,
        fileSize,
        fileType: 'magnet',
        resourceMeta: {
          magnetHash,
          detailUrl: guid || null,
          pubDate: pubDate ? new Date(pubDate).toISOString() : null,
          description: description || null,
        },
      })
    }

    return results
  }

  private extractTag(xml: string, tag: string): string | null {
    const regex = new RegExp(
      `<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>|<${tag}[^>]*>([\\s\\S]*?)</${tag}>`,
      'i',
    )
    const match = xml.match(regex)
    return match?.[1] ?? match?.[2] ?? null
  }

  private parseFileSize(description: string | null): number | undefined {
    if (!description) return undefined
    // BT4G description 格式："...<br>1.23 GB<br>..."
    const parts = description.split(/<br\s*\/?>/i)
    if (parts.length < 2) return undefined
    const sizeStr = parts[1].trim()
    const match = sizeStr.match(/([\d.]+)\s*(B|KB|MB|GB|TB)/i)
    if (!match) return undefined
    const num = parseFloat(match[1])
    const unit = match[2].toUpperCase()
    const multipliers: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 ** 2,
      GB: 1024 ** 3,
      TB: 1024 ** 4,
    }
    return num * (multipliers[unit] || 1)
  }

  async healthCheck(): Promise<boolean> {
    if (!this.enabled) return false
    try {
      const response = await fetch(this.baseUrl, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000),
      })
      return response.ok || response.status === 405 // 某些站不支持 HEAD
    } catch {
      return false
    }
  }
}
