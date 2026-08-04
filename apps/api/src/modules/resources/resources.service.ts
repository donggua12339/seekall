import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { MeiliSearch } from 'meilisearch'
import type { SearchHit } from '../search/search.service'

/** 资源索引（MeiliSearch）：把搜索结果沉淀成可查询的资源库 */
const INDEX = 'resources'

/** 只沉淀"资源类"结果；general 多为文章/新闻，不进榜 */
const INDEXABLE_CATEGORIES = new Set(['pan', 'software', 'game', 'anime'])

export interface ResourceDoc {
  /** 归一化后的 url（去尾部斜杠），作为主键 */
  id: string
  title: string
  url: string
  snippet?: string
  source?: string
  category?: string
  fileType?: string
  firstSeenAt: string
  lastSeenAt: string
  hitCount: number
}

@Injectable()
export class ResourcesService implements OnModuleInit {
  private readonly logger = new Logger(ResourcesService.name)
  private client: MeiliSearch | null = null

  private getClient(): MeiliSearch | null {
    if (this.client) return this.client
    const host = process.env.MEILISEARCH_URL
    const apiKey = process.env.MEILISEARCH_MASTER_KEY
    if (!host || !apiKey) return null
    this.client = new MeiliSearch({ host, apiKey })
    return this.client
  }

  async onModuleInit(): Promise<void> {
    const client = this.getClient()
    if (!client) {
      this.logger.warn('MEILISEARCH_URL/KEY 未配置，资源索引功能关闭')
      return
    }
    try {
      try {
        await client.createIndex(INDEX, { primaryKey: 'id' })
      } catch {
        // 索引已存在则忽略
      }
      await client.index(INDEX).updateSettings({
        searchableAttributes: ['title', 'snippet', 'source'],
        sortableAttributes: ['hitCount', 'firstSeenAt', 'lastSeenAt'],
        filterableAttributes: ['category', 'firstSeenAt'],
      })
      this.logger.log('资源索引就绪 (meilisearch)')
    } catch (err) {
      this.logger.warn(`资源索引初始化失败: ${(err as Error).message}`)
    }
  }

  /** 归一化 url 作为主键 */
  private docId(url: string): string {
    return url.replace(/\/+$/, '')
  }

  /**
   * 把本次搜索结果沉淀进索引（fire-and-forget，绝不阻塞/影响搜索主流程）。
   * 已存在的 url 累加 hitCount 并保留 firstSeenAt；新 url 记首次发现时间。
   */
  indexHits(hits: SearchHit[]): void {
    const client = this.getClient()
    if (!client) return

    const now = new Date().toISOString()
    const docs: ResourceDoc[] = []
    for (const h of hits) {
      const category = (h.meta?.category as string) || 'general'
      if (!INDEXABLE_CATEGORIES.has(category) || !h.url) continue
      docs.push({
        id: this.docId(h.url),
        title: (h.title || '').slice(0, 200),
        url: h.url,
        snippet: (h.snippet || '').slice(0, 200) || undefined,
        source: h.source,
        category,
        fileType: (h.meta?.fileType as string) || undefined,
        firstSeenAt: now,
        lastSeenAt: now,
        hitCount: 1,
      })
    }
    if (!docs.length) return

    this.upsert(docs).catch((err) =>
      this.logger.warn(`资源索引写入失败: ${(err as Error).message}`),
    )
  }

  private async upsert(docs: ResourceDoc[]): Promise<void> {
    const client = this.getClient()
    if (!client) return
    const idx = client.index(INDEX)

    // 取回已有文档的 firstSeenAt / hitCount，避免覆盖（不存在则静默跳过）
    const existing = new Map<string, Partial<ResourceDoc>>()
    await Promise.all(
      docs.map(async (d) => {
        try {
          const old = await idx.getDocument<{ id: string; firstSeenAt: string; hitCount: number }>(
            d.id,
            { fields: ['id', 'firstSeenAt', 'hitCount'] },
          )
          if (old && old.id) existing.set(old.id, old)
        } catch {
          // 文档不存在 → 新资源
        }
      }),
    )

    const finalDocs = docs.map((d) => {
      const old = existing.get(d.id)
      if (!old) return d
      return {
        ...d,
        firstSeenAt: old.firstSeenAt || d.firstSeenAt,
        hitCount: (old.hitCount || 0) + 1,
      }
    })

    await idx.addDocuments(finalDocs)
  }

  /** 热门资源榜（按累计命中次数降序） */
  async hot(limit = 50): Promise<ResourceDoc[]> {
    return this.ranked('hitCount:desc', limit)
  }

  /** 最新入库（按首次发现时间降序） */
  async latest(limit = 50): Promise<ResourceDoc[]> {
    return this.ranked('firstSeenAt:desc', limit)
  }

  private async ranked(sort: string, limit: number): Promise<ResourceDoc[]> {
    const client = this.getClient()
    if (!client) return []
    try {
      const res = await client.index(INDEX).search('', { sort: [sort], limit })
      return res.hits as unknown as ResourceDoc[]
    } catch (err) {
      this.logger.warn(`资源榜单查询失败: ${(err as Error).message}`)
      return []
    }
  }
}
