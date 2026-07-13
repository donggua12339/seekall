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
    } catch (err) {
      this.logger.error(`Meilisearch connection failed: ${(err as Error).message}`)
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

  async ensureIndex(indexName: string, options: {
    searchableAttributes?: string[]
    filterableAttributes?: string[]
    sortableAttributes?: string[]
  }): Promise<void> {
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
