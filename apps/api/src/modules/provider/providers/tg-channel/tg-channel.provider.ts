import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Provider, SearchQuery, SearchResult } from '../../interfaces/provider.interface'

/**
 * TG 频道 Provider
 * 通过 PanSou API 的 src=channel 参数，专门搜索 TG 频道资源
 *
 * 与 PansouProvider 的区别：
 *   - PansouProvider: src=all（频道 + 插件），覆盖所有网盘
 *   - TgChannelProvider: src=channel，仅 TG 频道，结果更精准
 *
 * 用于：
 *   - 用户想专门搜索 TG 频道分享的资源
 *   - 作为 PansouProvider 的补充（当插件源失效时，TG 频道可能仍有结果）
 */
@Injectable()
export class TgChannelProvider implements Provider {
  private readonly logger = new Logger(TgChannelProvider.name)
  readonly name = 'tg-channel'
  readonly displayName = 'TG 频道'
  readonly category = 'tg' as const

  private readonly apiUrls: string[]
  private readonly apiKey?: string
  private readonly timeout: number
  private readonly maxRetries = 2

  private readonly cloudTypeMap: Record<string, string> = {
    baidu: '百度网盘',
    aliyun: '阿里云盘',
    quark: '夸克网盘',
    tianyi: '天翼云盘',
    uc: 'UC 网盘',
    mobile: '移动云盘',
    '115': '115 网盘',
    pikpak: 'PikPak',
    xunlei: '迅雷云盘',
    '123': '123 网盘',
    magnet: '磁力',
    ed2k: 'eD2k',
  }

  constructor(private readonly configService: ConfigService) {
    const urls = this.configService.get<string>('PANSOU_API_URLS', '')
    const singleUrl = this.configService.get<string>('PANSOU_API_URL', 'https://so.252035.xyz')
    this.apiUrls = urls
      ? urls
          .split(',')
          .map((u) => u.trim())
          .filter(Boolean)
      : [singleUrl]
    this.apiKey = this.configService.get<string>('PANSOU_API_KEY')
    this.timeout = this.configService.get<number>('PANSOU_TIMEOUT', 10000)
  }

  get enabled(): boolean {
    return this.apiUrls.length > 0
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.enabled) return []

    for (const apiUrl of this.apiUrls) {
      const results = await this.searchWithRetry(apiUrl, query)
      if (results.length > 0) {
        return results
      }
    }
    return []
  }

  private async searchWithRetry(apiUrl: string, query: SearchQuery): Promise<SearchResult[]> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const url = new URL('/api/search', apiUrl)
        url.searchParams.set('kw', query.keyword)
        url.searchParams.set('res', 'merge')
        url.searchParams.set('src', 'channel') // 仅 TG 频道
        if (query.page) url.searchParams.set('page', String(query.page))

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), this.timeout)

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'User-Agent': 'SeekAll/0.1.0',
            ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          },
          signal: controller.signal,
        })

        clearTimeout(timer)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('application/json')) {
          throw new Error(`Non-JSON response: ${contentType}`)
        }

        const data = await response.json()
        return this.transform(data)
      } catch (err) {
        const msg = (err as Error).message
        this.logger.debug(`TG channel ${apiUrl} attempt ${attempt + 1} failed: ${msg}`)
        if (attempt === this.maxRetries) {
          this.logger.warn(`TG channel ${apiUrl} exhausted retries: ${msg}`)
          return []
        }
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
    return []
  }

  private transform(data: unknown): SearchResult[] {
    const result: SearchResult[] = []
    const payload = data as {
      data?: {
        merged_by_type?: Record<
          string,
          Array<{
            url: string
            note?: string
            password?: string
            datetime?: string
            source?: string
          }>
        >
      }
    }

    if (!payload?.data?.merged_by_type) return []

    for (const [cloudType, items] of Object.entries(payload.data.merged_by_type)) {
      if (!Array.isArray(items)) continue
      for (const item of items) {
        if (!item.url) continue
        result.push({
          title: item.note || `${this.cloudTypeMap[cloudType] || cloudType} 资源`,
          url: item.url,
          source: this.name,
          sourceDisplayName: this.displayName,
          category: this.category,
          fileType: this.cloudTypeMap[cloudType] || cloudType,
          resourceMeta: {
            cloudType,
            password: item.password || null,
            datetime: item.datetime || null,
            originSource: item.source || null,
          },
        })
      }
    }

    return result
  }

  async healthCheck(): Promise<boolean> {
    for (const apiUrl of this.apiUrls) {
      try {
        const response = await fetch(new URL('/api/search?kw=test&src=channel', apiUrl).toString(), {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(5000),
        })
        if (response.ok && (response.headers.get('content-type') || '').includes('application/json')) {
          return true
        }
      } catch {
        // try next
      }
    }
    return false
  }
}
