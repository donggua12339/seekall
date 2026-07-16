import { Injectable, Logger } from '@nestjs/common'
import { MeiliSearch } from 'meilisearch'
import { Provider, SearchQuery, SearchResult } from '../../interfaces/provider.interface'

/**
 * DHT 自爬 Provider
 *
 * 从香港服务器的 dht-crawler 服务收集的索引搜索磁力资源。
 *
 * 数据流：
 *   DHT 网络 -> dht-crawler (香港服务器) -> Meilisearch (香港 7799, dht-resources 索引)
 *   用户搜索 -> DhtProvider -> 查询香港 Meilisearch -> 返回磁力链接
 *
 * 配置：
 *   DHT_MEILISEARCH_URL=http://<REDACTED_SERVER_IP>:7799
 *   DHT_MEILISEARCH_KEY=xxx
 *   留空则禁用
 */
@Injectable()
export class DhtProvider implements Provider {
  private readonly logger = new Logger(DhtProvider.name)
  readonly name = 'dht'
  readonly displayName = 'DHT 自爬'
  readonly category = 'magnet' as const

  private readonly indexName = 'dht-resources'
  private readonly client: MeiliSearch | null
  /**
   * 索引是否就绪（存在且有数据）。
   * - false 时 enabled=false，search 直接返回空，不浪费超时时间
   * - 由 healthCheck 异步刷新，避免构造时阻塞
   */
  private indexReady = false

  constructor() {
    const url = process.env.DHT_MEILISEARCH_URL || ''
    const key = process.env.DHT_MEILISEARCH_KEY || ''
    if (url) {
      this.client = new MeiliSearch({ host: url, apiKey: key })
      // 异步尝试创建/确认索引存在（不阻塞构造）
      this.ensureRemoteIndex().catch((err) => {
        this.logger.warn(`DHT remote index init failed: ${(err as Error).message}`)
      })
    } else {
      this.client = null
    }
  }

  /**
   * 远端 Meilisearch（香港 7799）上 dht-resources 索引不存在时主动创建。
   * 即使 dht-crawler 还没写入数据，空索引也能让 search 不再触发 index_not_found。
   */
  private async ensureRemoteIndex(): Promise<void> {
    if (!this.client) return
    try {
      await this.client.getIndex(this.indexName)
      this.indexReady = true
    } catch {
      try {
        await this.client.createIndex(this.indexName)
        this.logger.log(`Created remote Meilisearch index: ${this.indexName}`)
        this.indexReady = true
      } catch (err) {
        this.logger.warn(
          `Cannot create remote index ${this.indexName} (likely no write permission or network): ${(err as Error).message}`,
        )
      }
    }
  }

  get enabled(): boolean {
    return this.client !== null && this.indexReady
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    if (!this.client || !this.indexReady) return []

    try {
      const result = await this.client.index(this.indexName).search(query.keyword, {
        limit: query.pageSize || 20,
        showRankingScore: true,
        attributesToRetrieve: ['title', 'infohash', 'url', 'fileType', 'indexedAt'],
      })

      return (result.hits as unknown[]).map((hit) => {
        const h = hit as Record<string, unknown>
        const hash = String(h.infohash ?? '')
        const url = String(h.url ?? `magnet:?xt=urn:btih:${hash}`)

        return {
          title: String(h.title ?? ''),
          url,
          source: this.name,
          sourceDisplayName: this.displayName,
          category: this.category,
          fileType: '磁力',
          resourceMeta: {
            magnetHash: hash || null,
            datetime: h.indexedAt ? String(h.indexedAt) : null,
          },
        }
      })
    } catch (err) {
      this.logger.debug(`DHT search failed: ${(err as Error).message}`)
      return []
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.client) return false
    try {
      const stats = await this.client.index(this.indexName).getStats()
      // 索引有数据时才认为就绪
      this.indexReady = stats.numberOfDocuments > 0
      return this.indexReady
    } catch {
      this.indexReady = false
      return false
    }
  }
}
