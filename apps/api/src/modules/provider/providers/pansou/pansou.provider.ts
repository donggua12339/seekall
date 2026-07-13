import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Provider, SearchQuery, SearchResult } from '../../interfaces/provider.interface'

/**
 * PanSou API Provider
 * 文档参考：https://github.com/fish2018/pansou
 *
 * 支持多 URL 故障转移：
 *   PANSOU_API_URLS=https://so.252035.xyz,https://panso.example.com
 *   向后兼容 PANSOU_API_URL（单个 URL）
 *
 * 支持重试：
 *   每个URL最多重试2次，间隔1秒
 *   Cloudflare 拦截（返回HTML）时自动切换下一个URL
 */
@Injectable()
export class PansouProvider implements Provider {
  private readonly logger = new Logger(PansouProvider.name)
  readonly name = 'pansou'
  readonly displayName = 'PanSou 聚合'
  readonly category = 'netdisk' as const

  private readonly apiUrls: string[]
  private readonly apiKey?: string
  private readonly timeout: number
  private readonly maxRetries = 2

  // PanSou cloud_type -> SeekAll category 映射
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
    // 支持多 URL（逗号分隔），向后兼容单 URL
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

    // 遍历所有 URL，直到成功返回结果
    for (const apiUrl of this.apiUrls) {
      const results = await this.searchWithRetry(apiUrl, query)
      if (results.length > 0) {
        return results
      }
      // 空结果可能是正常的（关键词没匹配），也可能是被拦截
      // 继续尝试下一个 URL
    }

    return []
  }

  private async searchWithRetry(apiUrl: string, query: SearchQuery): Promise<SearchResult[]> {
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const url = new URL('/api/search', apiUrl)
        url.searchParams.set('kw', query.keyword)
        url.searchParams.set('res', 'merge')
        url.searchParams.set('src', 'all')
        if (query.page) url.searchParams.set('page', String(query.page))

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), this.timeout)

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'User-Agent': 'SeekAll/0.1.0 (https://github.com/seekall)',
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
          // Cloudflare 拦截返回 HTML
          throw new Error(`Non-JSON response (likely Cloudflare): ${contentType}`)
        }

        const data = await response.json()
        const results = this.transform(data)
        if (results.length > 0) {
          return results
        }
        // 空结果，不重试（可能是正常情况）
        return []
      } catch (err) {
        const msg = (err as Error).message
        this.logger.debug(`Pansou ${apiUrl} attempt ${attempt + 1} failed: ${msg}`)

        // 最后一次尝试失败，不再重试
        if (attempt === this.maxRetries) {
          this.logger.warn(`Pansou ${apiUrl} exhausted retries: ${msg}`)
          return []
        }

        // 延迟重试（1秒，避免触发限流）
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
    return []
  }

  private transform(data: unknown): SearchResult[] {
    const result: SearchResult[] = []
    const payload = data as {
      code?: number
      data?: {
        total?: number
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
        results?: Array<{
          title: string
          content?: string
          channel?: string
          datetime?: string
          links?: Array<{ type: string; url: string; password?: string }>
          tags?: string[]
        }>
      }
    }

    if (!payload?.data) return []

    // 优先用 merged_by_type
    if (payload.data.merged_by_type) {
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

    // 回退：results 数组
    if (payload.data.results && Array.isArray(payload.data.results)) {
      for (const r of payload.data.results) {
        if (!r.links || r.links.length === 0) continue
        for (const link of r.links) {
          if (!link.url) continue
          result.push({
            title: r.title,
            url: link.url,
            source: this.name,
            sourceDisplayName: this.displayName,
            category: this.category,
            fileType: this.cloudTypeMap[link.type] || link.type,
            resourceMeta: {
              cloudType: link.type,
              password: link.password || null,
              content: r.content || null,
              channel: r.channel || null,
              datetime: r.datetime || null,
              tags: r.tags || [],
            },
          })
        }
      }
    }

    return result
  }

  async healthCheck(): Promise<boolean> {
    for (const apiUrl of this.apiUrls) {
      try {
        const response = await fetch(new URL('/api/search?kw=test', apiUrl).toString(), {
          method: 'GET',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(5000),
        })
        if (response.ok && (response.headers.get('content-type') || '').includes('application/json')) {
          return true
        }
      } catch {
        // 尝试下一个 URL
      }
    }
    return false
  }
}
