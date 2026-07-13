import { Injectable, Logger } from '@nestjs/common'
import { MeilisearchService } from '../../../meilisearch/meilisearch.service'
import { Provider, SearchQuery, SearchResult } from '../../interfaces/provider.interface'

/**
 * TG 频道直连 Provider
 *
 * 不依赖 PanSou，直接从 TG Collector 收集的本地索引搜索。
 * 需要先运行 apps/tg-collector 服务收集频道消息。
 *
 * 数据流：
 *   TG 频道 -> tg-collector 服务 -> Meilisearch (tg-resources 索引)
 *   用户搜索 -> TgDirectProvider -> 查询 Meilisearch -> 返回结果
 */
@Injectable()
export class TgDirectProvider implements Provider {
  private readonly logger = new Logger(TgDirectProvider.name)
  readonly name = 'tg-direct'
  readonly displayName = 'TG 频道直连'
  readonly category = 'tg' as const

  private readonly indexName = 'tg-resources'

  constructor(
    private readonly meilisearchService: MeilisearchService,
  ) {}

  get enabled(): boolean {
    // 当 Meilisearch 可用时启用
    return true
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    try {
      const client = this.meilisearchService.getClient()
      const result = await client.index(this.indexName).search(query.keyword, {
        limit: query.pageSize || 20,
        showRankingScore: true,
        attributesToRetrieve: [
          'title',
          'url',
          'cloudType',
          'cloudName',
          'password',
          'channel',
          'messageDate',
        ],
      })

      return (result.hits as unknown[]).map((hit) => {
        const h = hit as Record<string, unknown>
        return {
          title: String(h.title ?? ''),
          url: String(h.url ?? ''),
          source: this.name,
          sourceDisplayName: this.displayName,
          category: this.category,
          fileType: h.cloudName ? String(h.cloudName) : undefined,
          resourceMeta: {
            cloudType: h.cloudType ? String(h.cloudType) : undefined,
            password: (h.password as string) || null,
            datetime: h.messageDate ? String(h.messageDate) : null,
            originSource: h.channel ? `tg:${h.channel}` : null,
          },
        }
      })
    } catch (err) {
      this.logger.debug(`TG direct search failed: ${(err as Error).message}`)
      // 索引不存在或 Meilisearch 不可用时返回空
      return []
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = this.meilisearchService.getClient()
      const stats = await client.index(this.indexName).getStats()
      return stats.numberOfDocuments > 0
    } catch {
      return false
    }
  }
}
