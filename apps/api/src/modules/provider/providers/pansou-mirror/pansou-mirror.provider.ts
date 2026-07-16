import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Provider, SearchQuery, SearchResult } from '../../interfaces/provider.interface'

/**
 * PanSou 镜像 Provider
 *
 * 与主 PansouProvider 的区别：
 *   - 主 PansouProvider 用 PANSOU_API_URLS（默认 so.252035.xyz）
 *   - 本 Provider 用 PANSOU_MIRROR_URLS（用户自建或第三方镜像）
 *
 * 用途：
 *   - 分散 PanSou 单点依赖，主源失败时镜像源可能可用
 *   - 用户自建 PanSou 实例后配置 PANSOU_MIRROR_URLS 即可接入
 *   - 不与主 PansouProvider 重复（URL 列表独立）
 *
 * 配置：
 *   PANSOU_MIRROR_URLS=https://my-pansou.example.com,https://pansou2.example.com
 *   留空则禁用本 Provider
 */
@Injectable()
export class PansouMirrorProvider implements Provider {
  private readonly logger = new Logger(PansouMirrorProvider.name)
  readonly name = 'pansou-mirror'
  readonly displayName = 'PanSou 镜像'
  readonly category = 'netdisk' as const

  private readonly apiUrls: string[]
  private readonly timeout: number

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
    const urls = this.configService.get<string>('PANSOU_MIRROR_URLS', '')
    this.apiUrls = urls
      ? urls
          .split(',')
          .map((u) => u.trim())
          .filter(Boolean)
      : []
    this.timeout = this.configService.get<number>('PANSOU_MIRROR_TIMEOUT', 4000)
  }

  get enabled(): boolean {
    return this.apiUrls.length > 0
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.enabled) return []

    for (const apiUrl of this.apiUrls) {
      try {
        const url = new URL('/api/search', apiUrl)
        const body = {
          kw: query.keyword,
          res: 'merge',
          ...(query.page ? { page: query.page } : {}),
        }

        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), this.timeout)

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'User-Agent': 'SeekAll/0.1.0',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        })

        clearTimeout(timer)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        const results = this.transform(data)
        if (results.length > 0) return results
      } catch (err) {
        this.logger.debug(`Mirror ${apiUrl} failed: ${(err as Error).message}`)
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
        const response = await fetch(new URL('/api/search', apiUrl).toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kw: 'test', res: 'merge' }),
          signal: AbortSignal.timeout(3000),
        })
        if (response.ok) return true
      } catch {
        // try next
      }
    }
    return false
  }
}
