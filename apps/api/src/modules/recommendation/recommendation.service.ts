import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { MeilisearchService } from '../meilisearch/meilisearch.service'
import { classifyResource, TAG_LABELS } from '../../common/utils/resource-tagger.util'

interface RecommendationItem {
  title: string
  url: string
  source: string
  fileType?: string
  tags: string[]
  tagsLabel: string[]
  score: number
}

export interface RecommendResult {
  items: RecommendationItem[]
  basedOn: string[]
}

@Injectable()
export class RecommendationService {
  private readonly logger = new Logger(RecommendationService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly meilisearchService: MeilisearchService,
  ) {}

  /**
   * 基于用户搜索历史推荐资源
   * 策略：
   * 1. 取用户最近 20 条搜索历史
   * 2. 提取高频关键词和标签
   * 3. 用关键词在 Meilisearch 搜索
   * 4. 去重 + 按相关度排序
   */
  async recommendForUser(userId: bigint, limit: number = 10): Promise<RecommendResult> {
    if (!this.prisma.isAvailable()) {
      return { items: [], basedOn: [] }
    }

    // 1. 取最近搜索历史
    const history = await this.prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { query: true },
    })

    if (history.length === 0) {
      // 无历史时返回热门搜索词的结果
      return this.recommendPopular(limit)
    }

    // 2. 提取关键词（去重，取前 5 个）
    const keywords = [...new Set(history.map((h) => h.query).filter(Boolean))].slice(0, 5)

    // 3. 用关键词在 Meilisearch 搜索
    const items: Map<string, RecommendationItem> = new Map()

    try {
      const client = this.meilisearchService.getClient()

      for (const keyword of keywords) {
        const result = await client.index('resources').search(keyword, {
          limit: 5,
          showRankingScore: true,
          attributesToRetrieve: ['title', 'url', 'source', 'sourceDisplayName', 'fileType'],
        })

        for (const hit of result.hits as unknown[]) {
          const h = hit as Record<string, unknown> & { _rankingScore?: number }
          if (!h.url || items.has(String(h.url))) continue

          const title = String(h.title ?? '')
          const tags = classifyResource(title)
          items.set(String(h.url), {
            title,
            url: String(h.url),
            source: String(h.source ?? ''),
            fileType: h.fileType ? String(h.fileType) : undefined,
            tags,
            tagsLabel: tags.map((t) => TAG_LABELS[t as keyof typeof TAG_LABELS]),
            score: (h._rankingScore || 0) * 100,
          })
        }
      }
    } catch (err) {
      this.logger.debug(`Recommendation search failed: ${(err as Error).message}`)
    }

    // 4. 按分数排序，取 top N
    const sorted = Array.from(items.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)

    return { items: sorted, basedOn: keywords }
  }

  /**
   * 热门推荐（无搜索历史时）
   */
  private async recommendPopular(limit: number): Promise<RecommendResult> {
    // 从搜索日志取热门关键词
    const popular = await this.prisma.searchLog.groupBy({
      by: ['query'],
      where: {
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        query: { not: '' },
      },
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take: 3,
    })

    const keywords = popular.map((p) => p.query)
    if (keywords.length === 0) {
      return { items: [], basedOn: [] }
    }

    const items: RecommendationItem[] = []

    try {
      const client = this.meilisearchService.getClient()
      for (const keyword of keywords) {
        const result = await client.index('resources').search(keyword, {
          limit: 3,
          attributesToRetrieve: ['title', 'url', 'source', 'sourceDisplayName', 'fileType'],
        })
        for (const hit of result.hits as unknown[]) {
          const h = hit as Record<string, unknown>
          if (!h.url) continue
          const title = String(h.title ?? '')
          const tags = classifyResource(title)
          items.push({
            title,
            url: String(h.url),
            source: String(h.source ?? ''),
            fileType: h.fileType ? String(h.fileType) : undefined,
            tags,
            tagsLabel: tags.map((t) => TAG_LABELS[t as keyof typeof TAG_LABELS]),
            score: 50,
          })
        }
      }
    } catch {
      // ignore
    }

    return {
      items: items.slice(0, limit),
      basedOn: keywords,
    }
  }
}
