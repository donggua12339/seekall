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
  /**
   * 索引是否有数据。tg-collector 服务没跑时索引为空，此时 disabled。
   * 避免每次搜索都去查一个必然为空的索引浪费 RTT。
   * 由 healthCheck 异步刷新。
   */
  private indexReady = false

  constructor(private readonly meilisearchService: MeilisearchService) {
    // 异步探测索引是否有数据（不阻塞构造）
    this.probeIndex().catch((err) => {
      this.logger.debug(`TG direct index probe failed: ${(err as Error).message}`)
    })
  }

  private async probeIndex(): Promise<void> {
    try {
      const stats = await this.meilisearchService.getClient().index(this.indexName).getStats()
      this.indexReady = stats.numberOfDocuments > 0
      if (this.indexReady) {
        this.logger.log(`TG direct index ready: ${stats.numberOfDocuments} documents`)
      } else {
        this.logger.warn(
          `TG direct index 'tg-resources' is empty. Run services/tg-collector to populate it. Provider will be disabled until data arrives.`,
        )
      }
    } catch (err) {
      this.logger.warn(`TG direct index probe failed: ${(err as Error).message}`)
      this.indexReady = false
    }
  }

  get enabled(): boolean {
    // 索引无数据时禁用，避免空查询浪费 RTT
    return this.indexReady
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.indexReady) return []
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
      return []
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const client = this.meilisearchService.getClient()
      const stats = await client.index(this.indexName).getStats()
      this.indexReady = stats.numberOfDocuments > 0
      return this.indexReady
    } catch {
      this.indexReady = false
      return false
    }
  }
}
