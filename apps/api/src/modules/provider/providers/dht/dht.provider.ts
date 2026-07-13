import { Injectable, Logger } from '@nestjs/common'
import { MeilisearchService } from '../../../meilisearch/meilisearch.service'
import { Provider, SearchQuery, SearchResult } from '../../interfaces/provider.interface'

/**
 * DHT 自爬 Provider
 *
 * 从 apps/dht-crawler 服务收集的本地索引搜索磁力资源。
 * 需要先运行 dht-crawler 服务加入 DHT 网络收集种子。
 *
 * 数据流：
 *   DHT 网络 -> dht-crawler 服务 -> Meilisearch (dht-resources 索引)
 *   用户搜索 -> DhtProvider -> 查询 Meilisearch -> 返回磁力链接
 *
 * 注意：DHT 爬虫需要公网 IP 和较大存储，50 人小圈子可能不划算。
 *       建议仅在需要磁力资源自治时启用。
 */
@Injectable()
export class DhtProvider implements Provider {
  private readonly logger = new Logger(DhtProvider.name)
  readonly name = 'dht'
  readonly displayName = 'DHT 自爬'
  readonly category = 'magnet' as const

  private readonly indexName = 'dht-resources'

  constructor(private readonly meilisearchService: MeilisearchService) {}

  get enabled(): boolean {
    return true
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    try {
      const client = this.meilisearchService.getClient()
      const result = await client.index(this.indexName).search(query.keyword, {
        limit: query.pageSize || 20,
        showRankingScore: true,
        attributesToRetrieve: ['infoHash', 'name', 'files', 'totalSize', 'magnet', 'discoveredAt'],
      })

      return (result.hits as unknown[]).map((hit) => {
        const h = hit as Record<string, unknown>
        const magnet = String(h.magnet ?? '')
        const totalSize = h.totalSize ? Number(h.totalSize) : undefined

        return {
          title: String(h.name ?? ''),
          url: magnet,
          source: this.name,
          sourceDisplayName: this.displayName,
          category: this.category,
          fileType: '磁力',
          fileSize: totalSize,
          resourceMeta: {
            magnetHash: h.infoHash ? String(h.infoHash) : null,
            datetime: h.discoveredAt ? new Date(Number(h.discoveredAt)).toISOString() : null,
          },
        }
      })
    } catch (err) {
      this.logger.debug(`DHT search failed: ${(err as Error).message}`)
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
