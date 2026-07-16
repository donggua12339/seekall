import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Provider, SearchQuery, SearchResult } from '../../interfaces/provider.interface'

// 关键词 token 最短长度（>=2 字符才作为匹配 token）
const MIN_TOKEN_LEN = 2

/**
 * Jackett Provider
 *
 * Jackett 是开源的 Torznab 聚合器，可对接 100+ 磁力/种子站点。
 * 用户自建 Jackett 服务（部署到香港服务器），本 Provider 通过 Torznab API 查询。
 *
 * 部署：
 *   docker run -d -p 9117:9117 linuxserver/jackett
 *   在 Jackett Web UI 添加索引器（1337x/ThePirateBay/Nyaa 等）
 *   配置 JACKETT_API_KEY=<jackett api key>
 *
 * 配置：
 *   JACKETT_URL=http://localhost:9117
 *   JACKETT_API_KEY=xxx
 *   留空则禁用
 *
 * Torznab API：
 *   GET /api/v2.0/indexers/all/results?apikey=xxx&q=keyword&limit=20
 *   返回 JSON，包含 results 数组
 */
@Injectable()
export class JackettProvider implements Provider {
  private readonly logger = new Logger(JackettProvider.name)
  readonly name = 'jackett'
  readonly displayName = 'Jackett 聚合'
  readonly category = 'magnet' as const

  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly timeout: number

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get<string>('JACKETT_URL', '')
    this.apiKey = this.configService.get<string>('JACKETT_API_KEY', '')
    this.timeout = this.configService.get<number>('JACKETT_TIMEOUT', 5000)
  }

  get enabled(): boolean {
    return this.baseUrl !== '' && this.apiKey !== ''
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.enabled) return []

    try {
      const url = new URL('/api/v2.0/indexers/all/results', this.baseUrl)
      url.searchParams.set('apikey', this.apiKey)
      url.searchParams.set('q', query.keyword)
      url.searchParams.set('limit', String((query.pageSize || 20) * 2))
      if (query.page && query.page > 1) {
        url.searchParams.set('offset', String((query.page - 1) * (query.pageSize || 20)))
      }

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'SeekAll/0.1.0',
        },
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      return this.transform(data, query.keyword)
    } catch (err) {
      this.logger.warn(`Jackett search failed: ${(err as Error).message}`)
      return []
    }
  }

  private transform(data: unknown, keyword: string): SearchResult[] {
    const result: SearchResult[] = []
    const payload = data as {
      Results?: Array<{
        Title?: string
        Guid?: string
        MagnetUri?: string
        Link?: string
        Size?: number
        PublishDate?: string
        Seeders?: number
        Peers?: number
        Tracker?: string
        Category?: string[]
      }>
    }

    if (!payload?.Results || !Array.isArray(payload.Results)) return []

    // 关键词相关性过滤（严格版）：
    // 1) 中文关键词：标题必须包含至少 1 个 3+ 字连续子串
    // 2) 纯英文关键词：长关键词 >=2 token、短关键词 >=1 token
    const tokens = this.extractTokens(keyword)
    const chineseSubstrings = this.extractChineseSubstrings(keyword)
    const isLongKeyword = tokens.length >= 3
    const minTokenMatches = isLongKeyword ? 2 : 1

    for (const r of payload.Results) {
      const url = r.MagnetUri || r.Link
      if (!url || !r.Title) continue

      // 只接受 magnet 或 http 链接
      if (!url.startsWith('magnet:') && !url.startsWith('http')) continue

      // 相关性过滤
      if (tokens.length > 0 && r.Title) {
        const lowerTitle = r.Title.toLowerCase()
        // 中文关键词：必须命中至少一个 3+ 字子串
        if (chineseSubstrings.length > 0) {
          const hasSubstringMatch = chineseSubstrings.some((s) =>
            lowerTitle.includes(s.toLowerCase()),
          )
          if (!hasSubstringMatch) continue
        } else {
          // 纯英文/数字关键词：回退到 token 匹配
          const matchCount = this.countTokenMatches(r.Title, tokens)
          if (matchCount < minTokenMatches) continue
        }
      }

      const hashMatch = url.match(/xt=urn:btih:([a-zA-Z0-9]+)/i)

      result.push({
        title: r.Title,
        url,
        source: this.name,
        sourceDisplayName: this.displayName,
        category: this.category,
        fileSize: r.Size,
        fileType: url.startsWith('magnet:') ? 'magnet' : 'torrent',
        resourceMeta: {
          magnetHash: hashMatch?.[1] || null,
          seeders: r.Seeders || 0,
          peers: r.Peers || 0,
          tracker: r.Tracker || null,
          publishDate: r.PublishDate || null,
          detailUrl: r.Guid || null,
          categories: r.Category || [],
        },
      })

      // 相关性过滤后结果可能很少，最多保留 limit*2 条
      if (result.length >= 40) break
    }

    if (result.length === 0) {
      this.logger.debug(
        `Jackett: 0 relevant results for "${keyword}" (raw ${payload.Results.length})`,
      )
    }

    return result
  }

  /**
   * 提取关键词 token：中文按 2-gram 切分，英文按空格切分
   * 例如 "我的世界辅助" -> ["我的", "世的", "世界", "界辅", "辅助", "world", "辅助"]
   * 英文 token 转小写
   */
  private extractTokens(keyword: string): string[] {
    const tokens: string[] = []
    const trimmed = keyword.trim().toLowerCase()
    if (!trimmed) return tokens

    // 切分中英文混合
    // 英文/数字 token（>=2 字符）
    const englishParts = trimmed.match(/[a-z0-9]{2,}/g) || []
    tokens.push(...englishParts)

    // 中文 2-gram
    const chineseChars = trimmed.match(/[\u4e00-\u9fa5]/g) || []
    for (let i = 0; i < chineseChars.length - 1; i++) {
      tokens.push(chineseChars[i] + chineseChars[i + 1])
    }
    // 单字也加入（仅当中文 >= 3 字时跳过单字，避免太宽泛）
    if (chineseChars.length > 0 && chineseChars.length < 3) {
      tokens.push(...chineseChars)
    }

    // 去重 + 去太短
    return Array.from(new Set(tokens)).filter((t) => t.length >= MIN_TOKEN_LEN)
  }

  /**
   * 提取关键词中连续的中文字符片段（>=3 字）
   * 例如 "我的世界辅助" -> ["我的世界辅助"]
   * "Minecraft 我的世界" -> ["我的世界"]
   */
  private extractChineseSubstrings(keyword: string): string[] {
    const trimmed = keyword.trim()
    if (!trimmed) return []
    // 匹配 3 个或更多连续中文字符
    const matches = trimmed.match(/[\u4e00-\u9fa5]{3,}/g) || []
    return matches
  }

  /**
   * 标题命中的 token 数量（大小写不敏感）
   */
  private countTokenMatches(title: string, tokens: string[]): number {
    const lowerTitle = title.toLowerCase()
    let count = 0
    for (const t of tokens) {
      if (lowerTitle.includes(t.toLowerCase())) count++
    }
    return count
  }

  async healthCheck(): Promise<boolean> {
    if (!this.enabled) return false
    try {
      const url = new URL('/api/v2.0/server/config', this.baseUrl)
      url.searchParams.set('apikey', this.apiKey)
      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(3000),
      })
      return response.ok
    } catch {
      return false
    }
  }
}
