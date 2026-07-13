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

// 缓存分级 TTL（秒）
const CACHE_TTL_POPULAR = 3600 // 热门词 1h
const CACHE_TTL_LONGTAIL = 600 // 长尾词 10min
const CACHE_TTL_EMPTY = 30 // 空结果 30s（防穿透）
const POPULARITY_THRESHOLD = 5 // 热门词阈值：7 天内搜索 >= 5 次
const POPULARITY_KEY = 'popular:keywords' // Redis ZSET key

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name)
  private readonly maxPageSize: number
  private readonly defaultPageSize: number

  constructor(
    private readonly providerService: ProviderService,
    private readonly prisma: PrismaService,
    private readonly meilisearchService: MeilisearchService,
    private readonly configService: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
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

    // 分级 TTL 缓存：热门 1h / 长尾 10min / 空结果 30s（防穿透）
    const ttl = await this.getCacheTtl(req.keyword, total)
    await this.redis.setex(cacheKey, ttl, JSON.stringify(response)).catch(() => {
      // 缓存写入失败不影响搜索
    })

    // 更新热门关键词计数（用于分级 TTL 判断）
    await this.bumpKeywordPopularity(req.keyword).catch(() => {
      // 计数失败不影响搜索
    })

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

  /**
   * 分级 TTL：热门词 1h / 长尾词 10min / 空结果 30s（防穿透）
   */
  private async getCacheTtl(keyword: string, resultCount: number): Promise<number> {
    if (resultCount === 0) return CACHE_TTL_EMPTY

    const score = await this.redis.zscore(POPULARITY_KEY, keyword).catch(() => null)
    const count = score ? Number(score) : 0
    return count >= POPULARITY_THRESHOLD ? CACHE_TTL_POPULAR : CACHE_TTL_LONGTAIL
  }

  /**
   * 更新关键词热门度（ZSET，7 天过期）
   */
  private async bumpKeywordPopularity(keyword: string): Promise<void> {
    const multi = this.redis.multi()
    multi.zincrby(POPULARITY_KEY, 1, keyword)
    multi.expire(POPULARITY_KEY, 7 * 24 * 60 * 60)
    await multi.exec()
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

  /**
   * 热门搜索预热 - 从搜索日志统计热门关键词并预缓存
   * 由定时任务调用，不写日志避免循环
   */
  async warmupPopularKeywords(limit: number = 20): Promise<{
    total: number
    succeeded: number
    failed: number
  }> {
    if (!this.prisma.isAvailable()) {
      return { total: 0, succeeded: 0, failed: 0 }
    }

    // 统计最近 7 天 top N 热门关键词
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const popular = await this.prisma.searchLog.groupBy({
      by: ['query'],
      where: {
        createdAt: { gte: since },
        query: { not: '' },
      },
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take: limit,
    })

    this.logger.log(`Warming up ${popular.length} popular keywords...`)

    let succeeded = 0
    let failed = 0

    for (const item of popular) {
      try {
        // 调用 search 但不写日志（userId 传 null，但 logSearch 仍会记录）
        // 这里用内部方法避免循环
        const result = await this.search(
          { keyword: item.query, page: 1, pageSize: 20 },
          null,
        )
        if (result.total > 0) {
          succeeded++
          this.logger.debug(`Warmed up "${item.query}": ${result.total} results`)
        } else {
          failed++
        }
      } catch (err) {
        failed++
        this.logger.debug(`Warmup "${item.query}" failed: ${(err as Error).message}`)
      }
    }

    this.logger.log(`Warmup completed: ${succeeded} succeeded, ${failed} failed`)
    return { total: popular.length, succeeded, failed }
  }
}
