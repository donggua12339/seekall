import { Injectable, Logger, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ProviderService } from '../provider/provider.service'
import { PrismaService } from '../../database/prisma.service'
import { MeilisearchService } from '../meilisearch/meilisearch.service'
import { REDIS_CLIENT } from '../../database/redis.module'
import { BusinessException } from '../../common/filters/http-exception.filter'
import { ErrorCode } from '../../common/constants/error-codes'
import type Redis from 'ioredis'
import { createHash } from 'crypto'

export interface SearchRequest {
  keyword: string
  page: number
  pageSize: number
  category?: string
  filters?: Record<string, unknown>
}

export interface SearchResponse {
  list: SearchResultItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  durationMs: number
  providers: string[]
  errors: string[]
  fromIndex?: boolean
}

export interface SearchResultItem {
  title: string
  url: string
  source: string
  sourceDisplayName: string
  category: string
  fileSize?: number
  fileType?: string
  isDead?: boolean
}

const MEILI_INDEX = 'resources'

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name)
  private readonly cacheTtl: number
  private readonly maxPageSize: number
  private readonly defaultPageSize: number

  constructor(
    private readonly providerService: ProviderService,
    private readonly prisma: PrismaService,
    private readonly meilisearchService: MeilisearchService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    this.cacheTtl = this.configService.get<number>('SEARCH_CACHE_TTL', 3600)
    this.maxPageSize = this.configService.get<number>('SEARCH_MAX_PAGE_SIZE', 50)
    this.defaultPageSize = this.configService.get<number>('SEARCH_DEFAULT_PAGE_SIZE', 20)
    // 初始化 Meilisearch 索引（异步，不阻塞启动）
    this.ensureMeilisearchIndex().catch((err) => {
      this.logger.warn(`Meilisearch index init failed: ${(err as Error).message}`)
    })
  }

  private async ensureMeilisearchIndex(): Promise<void> {
    await this.meilisearchService.ensureIndex(MEILI_INDEX, {
      searchableAttributes: ['title', 'fileType', 'sourceDisplayName'],
      filterableAttributes: ['category', 'fileType', 'source'],
      sortableAttributes: ['createdAt'],
    })
  }

  async search(req: SearchRequest, userId: bigint | null): Promise<SearchResponse> {
    // 参数校验
    if (!req.keyword || req.keyword.trim().length === 0) {
      throw new BusinessException(ErrorCode.SEARCH_QUERY_EMPTY)
    }
    if (req.keyword.length > 100) {
      throw new BusinessException(ErrorCode.SEARCH_QUERY_TOO_LONG)
    }

    const page = Math.max(1, req.page || 1)
    const pageSize = Math.min(this.maxPageSize, Math.max(1, req.pageSize || this.defaultPageSize))

    // 关键词黑名单校验（数据库不可用时跳过）
    const blocked = await this.checkBlockedKeyword(req.keyword).catch(() => false)
    if (blocked) {
      throw new BusinessException(ErrorCode.SEARCH_BLOCKED_KEYWORD)
    }

    // 缓存 key
    const cacheKey = this.buildCacheKey(req.keyword, page, pageSize, req.category)

    // 查缓存（Redis 不可用时跳过）
    const cached = await this.redis.get(cacheKey).catch(() => null)
    if (cached) {
      const result = JSON.parse(cached) as SearchResponse
      this.logSearch(userId, req.keyword, result.total, result.durationMs, 'cache')
      return { ...result, fromIndex: false }
    }

    // 调 Provider 聚合（核心功能）
    const { results, errors, durationMs } = await this.providerService.searchAll({
      keyword: req.keyword,
      page,
      pageSize,
      category: req.category,
      filters: req.filters,
    })

    // 过滤失效链接 & takedown 链接（数据库不可用时返回原始结果）
    const filtered = await this.filterInvalidResults(results).catch(() => results)

    // 分页
    const total = filtered.length
    const totalPages = Math.ceil(total / pageSize)
    const start = (page - 1) * pageSize
    const list = filtered.slice(start, start + pageSize)

    const response: SearchResponse = {
      list,
      total,
      page,
      pageSize,
      totalPages,
      durationMs,
      providers: this.providerService.getActiveProviders().map((p) => p.name),
      errors,
      fromIndex: false,
    }

    // 只缓存有结果的结果（空结果不缓存，避免失败被缓存）
    if (total > 0) {
      await this.redis.setex(cacheKey, this.cacheTtl, JSON.stringify(response)).catch(() => {
        // 缓存写入失败不影响搜索
      })
    }

    // 异步写入 Meilisearch 索引（用于模糊搜索）
    this.indexResults(filtered).catch((err) => {
      this.logger.debug(`Index results failed: ${(err as Error).message}`)
    })

    // 写日志
    this.logSearch(userId, req.keyword, total, durationMs, 'live')

    return response
  }

  /**
   * 模糊搜索 - 从本地 Meilisearch 索引查询
   * 用于：用户输入关键词后，除了实时搜索，还从历史索引中模糊匹配
   */
  async fuzzySearch(keyword: string, page: number = 1, pageSize: number = 20): Promise<SearchResponse> {
    const meili = this.meilisearchService.getClient()
    const result = await meili.index(MEILI_INDEX).search(keyword, {
      page,
      hitsPerPage: pageSize,
      attributesToRetrieve: ['title', 'url', 'source', 'sourceDisplayName', 'category', 'fileSize', 'fileType'],
      showRankingScore: true,
    })

    const list: SearchResultItem[] = (result.hits as unknown[]).map((hit) => {
      const h = hit as Record<string, unknown>
      return {
        title: String(h.title ?? ''),
        url: String(h.url ?? ''),
        source: String(h.source ?? ''),
        sourceDisplayName: String(h.sourceDisplayName ?? ''),
        category: String(h.category ?? 'netdisk'),
        fileSize: h.fileSize ? Number(h.fileSize) : undefined,
        fileType: h.fileType ? String(h.fileType) : undefined,
      }
    })

    return {
      list,
      total: result.totalHits ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((result.totalHits ?? 0) / pageSize),
      durationMs: result.processingTimeMs,
      providers: ['index'],
      errors: [],
      fromIndex: true,
    }
  }

  /**
   * 把搜索结果异步写入 Meilisearch 索引
   */
  private async indexResults(results: SearchResultItem[]): Promise<void> {
    if (results.length === 0) return

    const docs = results.map((r) => {
      const id = createHash('md5').update(r.url).digest('hex')
      return {
        id,
        title: r.title,
        url: r.url,
        source: r.source,
        sourceDisplayName: r.sourceDisplayName,
        category: r.category,
        fileSize: r.fileSize ?? null,
        fileType: r.fileType ?? null,
        createdAt: Date.now(),
      }
    })

    const meili = this.meilisearchService.getClient()
    await meili.index(MEILI_INDEX).addDocuments(docs, { primaryKey: 'id' })
  }

  private async checkBlockedKeyword(keyword: string): Promise<boolean> {
    if (!this.prisma.isAvailable()) return false
    const count = await this.prisma.blockedKeyword.count()
    if (count === 0) return false

    const blocked = await this.prisma.blockedKeyword.findMany()
    return blocked.some((b) => keyword.toLowerCase().includes(b.keyword.toLowerCase()))
  }

  private async filterInvalidResults(results: SearchResultItem[]): Promise<SearchResultItem[]> {
    if (results.length === 0) return []
    if (!this.prisma.isAvailable()) return results

    const urlHashes = results.map((r) => createHash('md5').update(r.url).digest('hex'))

    const takedownUrls = await this.prisma.takedownRecord.findMany({
      where: {
        resourceUrl: { in: results.map((r) => r.url) },
        status: 'resolved',
      },
      select: { resourceUrl: true },
    })
    const takedownSet = new Set(takedownUrls.map((t) => t.resourceUrl))

    const deadLinks = await this.prisma.linkStatusRecord.findMany({
      where: {
        urlHash: { in: urlHashes },
        status: 'dead',
      },
      select: { url: true },
    })
    const deadSet = new Set(deadLinks.map((l) => l.url))

    await this.recordLinks(results)

    return results.filter((r) => !takedownSet.has(r.url) && !deadSet.has(r.url))
  }

  private async recordLinks(results: SearchResultItem[]): Promise<void> {
    if (!this.prisma.isAvailable()) return

    const uniqueUrls = new Map<string, string>()
    for (const r of results) {
      const hash = createHash('md5').update(r.url).digest('hex')
      uniqueUrls.set(hash, r.url)
    }

    for (const [hash, url] of uniqueUrls) {
      try {
        await this.prisma.linkStatusRecord.upsert({
          where: { urlHash: hash },
          create: { urlHash: hash, url, status: 'unknown' },
          update: {},
        })
      } catch (err) {
        this.logger.debug(`Record link failed: ${(err as Error).message}`)
      }
    }
  }

  private buildCacheKey(keyword: string, page: number, pageSize: number, category?: string): string {
    const hash = createHash('md5')
      .update(`${keyword}|${page}|${pageSize}|${category || ''}`)
      .digest('hex')
    return `search:${hash}`
  }

  private async logSearch(
    userId: bigint | null,
    query: string,
    resultCount: number,
    durationMs: number,
    _source: 'cache' | 'live',
  ): Promise<void> {
    if (!this.prisma.isAvailable()) return
    try {
      await this.prisma.searchLog.create({
        data: {
          userId: userId ?? null,
          query,
          resultCount,
          source: 'web' as const,
          durationMs,
        },
      })
    } catch (err) {
      this.logger.debug(`Log search failed: ${(err as Error).message}`)
    }
  }
}
