import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Provider, SearchQuery, SearchResult } from '../../interfaces/provider.interface'

/**
 * 夸克网盘 Provider
 *
 * 实现策略：
 *   夸克网盘本身没有公开搜索 API，第三方爬虫站点反爬严格。
 *   本 Provider 通过调用 PanSou 的 qupansou 插件实现夸克网盘搜索。
 *   qupansou 是 PanSou 生态中专门搜索夸克网盘的插件。
 *
 * 调用方式：
 *   GET /search?kw=xxx&src=plugin&plugins=qupansou&res=merge
 *
 * 与 PansouProvider 的区别：
 *   - PansouProvider 调用所有源（src=all），返回多网盘结果
 *   - QuarkProvider 只调用 qupansou 插件，返回纯夸克结果
 *   - 用户可在前端选择"仅夸克"模式时启用此 Provider
 */
@Injectable()
export class QuarkProvider implements Provider {
  private readonly logger = new Logger(QuarkProvider.name)
  readonly name = 'quark'
  readonly displayName = '夸克网盘'
  readonly category = 'netdisk' as const

  private readonly apiUrl: string
  private readonly cookie?: string
  private readonly timeout: number
  private readonly pluginName: string

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>('PANSOU_API_URL', 'https://so.252035.xyz')
    this.cookie = this.configService.get<string>('QUARK_COOKIE')
    this.timeout = this.configService.get<number>('QUARK_TIMEOUT', 5000)
    // 可配置使用哪个 PanSou 插件搜索夸克（默认 qupansou）
    this.pluginName = this.configService.get<string>('QUARK_PANSOU_PLUGIN', 'qupansou')
  }

  get enabled(): boolean {
    // 只要 PanSou API 可用就启用（不强制要求 Cookie）
    return this.configService.get<string>('PANSOU_API_URL') !== undefined
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.enabled) return []

    try {
      const url = new URL('/api/search', this.apiUrl)
      url.searchParams.set('kw', query.keyword)
      url.searchParams.set('src', 'plugin')
      url.searchParams.set('plugins', this.pluginName)
      url.searchParams.set('res', 'merge')
      url.searchParams.set('cloud_types', 'quark')
      if (query.page) url.searchParams.set('page', String(query.page))

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'SeekAll/0.1.0',
          ...(this.cookie ? { Cookie: this.cookie } : {}),
        },
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      return this.transform(data)
    } catch (err) {
      this.logger.warn(`Quark search failed: ${(err as Error).message}`)
      return []
    }
  }

  private transform(data: unknown): SearchResult[] {
    const result: SearchResult[] = []
    const payload = data as {
      data?: {
        merged_by_type?: Record<string, Array<{
          url: string
          note?: string
          password?: string
          datetime?: string
          source?: string
        }>>
        results?: Array<{
          title: string
          content?: string
          datetime?: string
          links?: Array<{ type: string; url: string; password?: string }>
        }>
      }
    }

    if (!payload?.data) return []

    // 从 merged_by_type 提取夸克结果
    if (payload.data.merged_by_type?.quark) {
      for (const item of payload.data.merged_by_type.quark) {
        if (!item.url) continue
        result.push({
          title: item.note || '夸克网盘资源',
          url: item.url,
          source: this.name,
          sourceDisplayName: this.displayName,
          category: this.category,
          fileType: '夸克网盘',
          resourceMeta: {
            cloudType: 'quark',
            password: item.password || null,
            datetime: item.datetime || null,
            originSource: item.source || null,
          },
        })
      }
    }

    // 回退：从 results 数组提取 quark 链接
    if (result.length === 0 && payload.data.results) {
      for (const r of payload.data.results) {
        if (!r.links) continue
        for (const link of r.links) {
          if (link.type === 'quark' && link.url) {
            result.push({
              title: r.title,
              url: link.url,
              source: this.name,
              sourceDisplayName: this.displayName,
              category: this.category,
              fileType: '夸克网盘',
              resourceMeta: {
                cloudType: 'quark',
                password: link.password || null,
                datetime: r.datetime || null,
              },
            })
          }
        }
      }
    }

    return result
  }

  async healthCheck(): Promise<boolean> {
    if (!this.enabled) return false
    try {
      const response = await fetch(new URL('/health', this.apiUrl).toString(), {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      })
      return response.ok
    } catch {
      return false
    }
  }
}
