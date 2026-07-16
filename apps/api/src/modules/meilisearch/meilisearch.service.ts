import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { MeiliSearch } from 'meilisearch'

@Injectable()
export class MeilisearchService implements OnModuleInit {
  private readonly logger = new Logger(MeilisearchService.name)
  private client: MeiliSearch

  constructor() {
    this.client = new MeiliSearch({
      host: process.env.MEILISEARCH_URL || 'http://localhost:7700',
      apiKey: process.env.MEILISEARCH_MASTER_KEY,
    })
  }

  async onModuleInit() {
    try {
      await this.client.health()
      this.logger.log('Meilisearch connected')
      // 统一初始化本地 Meilisearch 所有应用索引
      // tg-resources / dht-resources 即使 tg-collector / dht-crawler 还没写入数据，
      // 也要先创建空索引，避免 Provider 查询时报 index_not_found。
      await this.ensureAllIndexes()
    } catch (err) {
      this.logger.error(`Meilisearch connection failed: ${(err as Error).message}`)
    }
  }

  /**
   * 初始化本地 Meilisearch 所有应用索引。
   * 新增 Provider 时只需要在这里追加一行配置。
   */
  private async ensureAllIndexes(): Promise<void> {
    const indexes: Array<{
      name: string
      options: Parameters<MeilisearchService['ensureIndex']>[1]
    }> = [
      {
        name: 'resources',
        options: {
          searchableAttributes: ['title', 'fileType', 'sourceDisplayName'],
          filterableAttributes: ['category', 'fileType', 'source'],
          sortableAttributes: ['createdAt'],
        },
      },
      {
        name: 'tg-resources',
        options: {
          searchableAttributes: ['title', 'cloudName', 'channel'],
          filterableAttributes: ['cloudType', 'cloudName', 'channel'],
          sortableAttributes: ['messageDate'],
        },
      },
    ]
    for (const { name, options } of indexes) {
      try {
        await this.ensureIndex(name, options)
      } catch (err) {
        this.logger.warn(`Failed to ensure index ${name}: ${(err as Error).message}`)
      }
    }
  }

  async health(): Promise<void> {
    const result = await this.client.health()
    if (result.status !== 'available') {
      throw new Error(`Meilisearch status: ${result.status}`)
    }
  }

  getClient(): MeiliSearch {
    return this.client
  }

  async ensureIndex(
    indexName: string,
    options: {
      searchableAttributes?: string[]
      filterableAttributes?: string[]
      sortableAttributes?: string[]
    },
  ): Promise<void> {
    try {
      await this.client.getIndex(indexName)
    } catch {
      await this.client.createIndex(indexName)
      this.logger.log(`Created Meilisearch index: ${indexName}`)
    }

    if (options.searchableAttributes) {
      await this.client.index(indexName).updateSearchableAttributes(options.searchableAttributes)
    }
    if (options.filterableAttributes) {
      await this.client.index(indexName).updateFilterableAttributes(options.filterableAttributes)
    }
    if (options.sortableAttributes) {
      await this.client.index(indexName).updateSortableAttributes(options.sortableAttributes)
    }
  }
}
