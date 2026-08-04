import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { MeiliSearch } from 'meilisearch'
import type { SearchHit } from '../search/search.service'

/** 资源索引（MeiliSearch）：把搜索结果沉淀成可查询的资源库 */
const INDEX = 'resources'

/** 只沉淀"资源类"结果；general 多为文章/新闻，不进榜 */
const INDEXABLE_CATEGORIES = new Set(['pan', 'software', 'game', 'anime'])

/** 时间范围筛选档位 */
export type TimeRange = 'today' | 'week' | 'month' | 'year' | 'all'

export interface ResourceDoc {
  /** url 归一化后的 sha1 hex（MeiliSearch 主键只允许字母/数字/-/_） */
  id: string
  title: string
  url: string
  snippet?: string
  source?: string
  category?: string
  fileType?: string
  /** ISO 串，用于展示与排序 */
  firstSeenAt: string
  /** epoch ms，用于时间范围过滤（MeiliSearch 比较运算符只支持数值） */
  firstSeenTs: number
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
        sortableAttributes: ['hitCount', 'firstSeenAt', 'firstSeenTs', 'lastSeenAt'],
        filterableAttributes: ['category', 'firstSeenTs'],
      })
      this.logger.log('资源索引就绪 (meilisearch)')
    } catch (err) {
      this.logger.warn(`资源索引初始化失败: ${(err as Error).message}`)
    }
  }

  /**
   * 文档主键：url 归一化后取 sha1 hex。
   * MeiliSearch 的 document id 只允许字母/数字/-/_，URL 含 :// 等字符会直接
   * 让整批 addDocuments 任务 failed（invalid_document_id）。
   */
  private docId(url: string): string {
    return createHash('sha1').update(url.replace(/\/+$/, '')).digest('hex')
  }

  /**
   * 把本次搜索结果沉淀进索引（fire-and-forget，绝不阻塞/影响搜索主流程）。
   * 已存在的 url 累加 hitCount 并保留 firstSeenAt/firstSeenTs；新 url 记首次发现时间。
   */
  indexHits(hits: SearchHit[]): void {
    const client = this.getClient()
    if (!client) return

    const nowMs = Date.now()
    const nowIso = new Date(nowMs).toISOString()
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
        firstSeenAt: nowIso,
        firstSeenTs: nowMs,
        lastSeenAt: nowIso,
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

    // 取回已有文档的 firstSeenAt/firstSeenTs/hitCount，避免覆盖（不存在则静默跳过）
    const existing = new Map<string, Partial<ResourceDoc>>()
    await Promise.all(
      docs.map(async (d) => {
        try {
          const old = await idx.getDocument<
            Pick<ResourceDoc, 'id' | 'firstSeenAt' | 'firstSeenTs' | 'hitCount'>
          >(d.id, { fields: ['id', 'firstSeenAt', 'firstSeenTs', 'hitCount'] })
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
        // 早期入库的文档可能没有 firstSeenTs，用 firstSeenAt 反推兜底
        firstSeenTs: old.firstSeenTs || Date.parse(old.firstSeenAt || '') || d.firstSeenTs,
        hitCount: (old.hitCount || 0) + 1,
      }
    })

    await idx.addDocuments(finalDocs)
  }

  /** 热门资源榜（按累计命中次数降序） */
  async hot(limit = 50, range?: TimeRange, category?: string): Promise<ResourceDoc[]> {
    return this.ranked('hitCount:desc', limit, range, category)
  }

  /** 最新入库（按首次发现时间降序） */
  async latest(limit = 50, range?: TimeRange, category?: string): Promise<ResourceDoc[]> {
    return this.ranked('firstSeenAt:desc', limit, range, category)
  }

  /** 时间范围阈值（epoch ms）。MeiliSearch 比较运算符只支持数值字段。 */
  private rangeThreshold(range?: TimeRange): number | null {
    if (!range || range === 'all') return null
    const now = Date.now()
    switch (range) {
      case 'today': {
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        return d.getTime()
      }
      case 'week':
        return now - 7 * 86400_000
      case 'month':
        return now - 30 * 86400_000
      case 'year':
        return now - 365 * 86400_000
      default:
        return null
    }
  }

  private buildFilter(range?: TimeRange, category?: string): string[] | undefined {
    const filters: string[] = []
    const threshold = this.rangeThreshold(range)
    if (threshold !== null) filters.push(`firstSeenTs >= ${threshold}`)
    if (category && category !== 'all') filters.push(`category = "${category}"`)
    return filters.length ? filters : undefined
  }

  private async ranked(
    sort: string,
    limit: number,
    range?: TimeRange,
    category?: string,
  ): Promise<ResourceDoc[]> {
    const client = this.getClient()
    if (!client) return []
    try {
      const res = await client
        .index(INDEX)
        .search('', { sort: [sort], limit, filter: this.buildFilter(range, category) })
      return res.hits as unknown as ResourceDoc[]
    } catch (err) {
      this.logger.warn(`资源榜单查询失败: ${(err as Error).message}`)
      return []
    }
  }
}
