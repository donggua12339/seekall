import { Injectable, Logger, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ProviderService } from '../provider/provider.service'
import { PrismaService } from '../../database/prisma.service'
import { MeilisearchService } from '../meilisearch/meilisearch.service'
import { classifyResource } from '../../common/utils/resource-tagger.util'
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
  fileType?: string
  sort?: string
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
  tags?: string[]
  voteUp?: number
  voteDown?: number
  resourceMeta?: {
    cloudType?: string
    password?: string | null
    datetime?: string | null
    magnetHash?: string | null
  }
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

    // 过滤失效链接 & takedown 链接 & NSFW 关键词（数据库不可用时返回原始结果）
    const filtered = await this.filterInvalidResults(results).catch(() => results)
    const nsfwFiltered = await this.filterBlockedKeywordResults(filtered).catch(() => filtered)

    // AI 资源标签（基于标题规则匹配，自动分类）
    const tagged = nsfwFiltered.map((r) => ({
      ...r,
      tags: classifyResource(r.title),
    }))

    // fileType 过滤
    const typeFiltered = req.fileType
      ? tagged.filter(
          (r) =>
            r.fileType === req.fileType ||
            r.fileType?.includes(req.fileType!) ||
            r.category === req.fileType,
        )
      : tagged

    // 排序
    const sorted = this.applySort(typeFiltered, req.sort)

    // 分页
    const total = sorted.length
    const totalPages = Math.ceil(total / pageSize)
    const start = (page - 1) * pageSize
    const list = sorted.slice(start, start + pageSize)

    // 多级 Fallback：实时搜索 0 结果时，依次尝试
    // 1. Meilisearch 索引（fuzzySearch）
    // 2. 热门关键词缓存（如果关键词近似匹配热门词）
    let finalList = list
    let finalTotal = total
    let finalTotalPages = totalPages
    let fromIndex = false
    if (total === 0) {
      // Level 1: Meilisearch 索引兜底
      try {
        const fuzzy = await this.fuzzySearch(req.keyword, page, pageSize)
        if (fuzzy.list.length > 0) {
          finalList = fuzzy.list
          finalTotal = fuzzy.total
          finalTotalPages = fuzzy.totalPages
          fromIndex = true
          this.logger.log(`Fallback L1 (index): ${fuzzy.list.length} hits for "${req.keyword}"`)
        }
      } catch (err) {
        this.logger.debug(`Fuzzy fallback failed: ${(err as Error).message}`)
      }

      // Level 2: 如果索引也空，尝试搜索日志中类似关键词的结果
      if (finalTotal === 0) {
        try {
          const similar = await this.searchSimilarKeyword(req.keyword, page, pageSize)
          if (similar.list.length > 0) {
            finalList = similar.list
            finalTotal = similar.total
            finalTotalPages = similar.totalPages
            fromIndex = true
            this.logger.log(
              `Fallback L2 (similar): ${similar.list.length} hits for "${req.keyword}"`,
            )
          }
        } catch (err) {
          this.logger.debug(`Similar fallback failed: ${(err as Error).message}`)
        }
      }
    }

    const response: SearchResponse = {
      list: finalList,
      total: finalTotal,
      page,
      pageSize,
      totalPages: finalTotalPages,
      durationMs,
      providers: this.providerService.getActiveProviders().map((p) => p.name),
      errors,
      fromIndex,
    }

    // 分级 TTL 缓存：热门 1h / 长尾 10min / 空结果 30s（防穿透）
    // 用 finalTotal（含 fallback）判断，避免 fallback 结果被当 0 结果短缓存
    const ttl = await this.getCacheTtl(req.keyword, finalTotal)
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
  async fuzzySearch(
    keyword: string,
    page: number = 1,
    pageSize: number = 20,
  ): Promise<SearchResponse> {
    const meili = this.meilisearchService.getClient()
    const result = await meili.index(MEILI_INDEX).search(keyword, {
      page,
      hitsPerPage: pageSize,
      attributesToRetrieve: [
        'title',
        'url',
        'source',
        'sourceDisplayName',
        'category',
        'fileSize',
        'fileType',
      ],
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

  /**
   * 黑名单关键词内存缓存（60s TTL，避免每次搜索都全表扫描）
   */
  private blockedKeywordsCache: { ts: number; keywords: string[] } | null = null
  private static readonly BLOCKED_KEYWORD_CACHE_TTL = 60_000

  private async getBlockedKeywords(): Promise<string[]> {
    if (!this.prisma.isAvailable()) return []
    const now = Date.now()
    if (
      this.blockedKeywordsCache &&
      now - this.blockedKeywordsCache.ts < SearchService.BLOCKED_KEYWORD_CACHE_TTL
    ) {
      return this.blockedKeywordsCache.keywords
    }
    const blocked = await this.prisma.blockedKeyword.findMany()
    const keywords = blocked.map((b) => b.keyword.toLowerCase())
    this.blockedKeywordsCache = { ts: now, keywords }
    return keywords
  }

  private async checkBlockedKeyword(keyword: string): Promise<boolean> {
    const lowered = await this.getBlockedKeywords()
    if (lowered.length === 0) return false
    const lower = keyword.toLowerCase()
    return lowered.some((kw) => lower.includes(kw))
  }

  /**
   * 过滤 Provider 返回结果中标题包含 NSFW / 黑名单关键词的条目
   * 防止 PanSou 等外部 API 返回侵权或违规资源
   */
  private async filterBlockedKeywordResults(
    results: SearchResultItem[],
  ): Promise<SearchResultItem[]> {
    if (results.length === 0) return []
    const lowered = await this.getBlockedKeywords()
    if (lowered.length === 0) return results
    return results.filter((r) => {
      const title = (r.title || '').toLowerCase()
      return !lowered.some((kw) => title.includes(kw))
    })
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

  private buildCacheKey(
    keyword: string,
    page: number,
    pageSize: number,
    category?: string,
  ): string {
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
   * 缓存流式搜索最终结果（供下次同样关键词的普通搜索命中缓存）
   * 由 stream 端点在流式完成后调用
   */
  async cacheStreamResult(
    keyword: string,
    page: number,
    pageSize: number,
    allResults: SearchResultItem[],
    durationMs: number,
    errors: string[],
  ): Promise<void> {
    try {
      const cacheKey = this.buildCacheKey(keyword, page, pageSize)
      const total = allResults.length
      const totalPages = Math.ceil(total / pageSize) || 1
      const start = (page - 1) * pageSize
      const list = allResults.slice(start, start + pageSize)

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

      const ttl = await this.getCacheTtl(keyword, total)
      await this.redis.setex(cacheKey, ttl, JSON.stringify(response)).catch(() => {})
      // 更新热门度
      await this.bumpKeywordPopularity(keyword).catch(() => {})
      // 异步写入 Meilisearch 索引
      this.indexResults(allResults).catch(() => {})
    } catch (err) {
      this.logger.debug(`Cache stream result failed: ${(err as Error).message}`)
    }
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
   * 同时填充 Meilisearch 索引（通过 search 方法内的 indexResults 异步写入）
   */
  async warmupPopularKeywords(limit: number = 100): Promise<{
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

    // 并发预热（每批 5 个，避免一次性打挂 Provider）
    const batchSize = 5
    for (let i = 0; i < popular.length; i += batchSize) {
      const batch = popular.slice(i, i + batchSize)
      const results = await Promise.allSettled(
        batch.map(async (item) => {
          const result = await this.search({ keyword: item.query, page: 1, pageSize: 20 }, null)
          return { query: item.query, total: result.total }
        }),
      )

      for (const r of results) {
        if (r.status === 'fulfilled') {
          if (r.value.total > 0) {
            succeeded++
            this.logger.debug(`Warmed up "${r.value.query}": ${r.value.total} results`)
          } else {
            failed++
          }
        } else {
          failed++
        }
      }
    }

    this.logger.log(`Warmup completed: ${succeeded} succeeded, ${failed} failed`)
    return { total: popular.length, succeeded, failed }
  }

  /**
   * Level 2 Fallback：搜索相似关键词的结果
   * 从搜索日志找包含查询词的高频关键词，用它的缓存结果
   */
  private async searchSimilarKeyword(
    keyword: string,
    page: number,
    pageSize: number,
  ): Promise<{ list: SearchResultItem[]; total: number; totalPages: number }> {
    if (!this.prisma.isAvailable()) {
      return { list: [], total: 0, totalPages: 0 }
    }

    try {
      // 从搜索日志找包含关键词的高频查询（7天内）
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      const similar = await this.prisma.searchLog.groupBy({
        by: ['query'],
        where: {
          createdAt: { gte: since },
          query: { contains: keyword.trim() },
          resultCount: { gt: 0 },
        },
        _count: { query: true },
        orderBy: { _count: { query: 'desc' } },
        take: 5,
      })

      // 尝试用相似词的缓存
      for (const item of similar) {
        if (item.query === keyword) continue // 跳过自身
        const cacheKey = this.buildCacheKey(item.query, page, pageSize)
        const cached = await this.redis.get(cacheKey).catch(() => null)
        if (cached) {
          const result = JSON.parse(cached) as SearchResponse
          this.logger.debug(`Similar keyword "${item.query}" cache hit for "${keyword}"`)
          return {
            list: result.list.slice(0, pageSize),
            total: result.total,
            totalPages: result.totalPages,
          }
        }
      }
    } catch (err) {
      this.logger.debug(`Search similar keyword failed: ${(err as Error).message}`)
    }

    return { list: [], total: 0, totalPages: 0 }
  }

  /**
   * 排序：relevance(默认) / time / size / source
   */
  private applySort(results: SearchResultItem[], sort?: string): SearchResultItem[] {
    if (!sort || sort === 'relevance') {
      return results // 保持 Provider 返回顺序（相关度优先）
    }
    const arr = [...results]
    if (sort === 'time') {
      arr.sort((a, b) => {
        const ta = this.extractTime(a) || 0
        const tb = this.extractTime(b) || 0
        return tb - ta
      })
    } else if (sort === 'size') {
      arr.sort((a, b) => (b.fileSize || 0) - (a.fileSize || 0))
    } else if (sort === 'source') {
      arr.sort((a, b) => a.sourceDisplayName.localeCompare(b.sourceDisplayName))
    }
    return arr
  }

  private extractTime(item: SearchResultItem): number | null {
    const meta = item.resourceMeta as { datetime?: string | null } | undefined
    if (!meta?.datetime) return null
    const t = new Date(meta.datetime).getTime()
    return isNaN(t) ? null : t
  }

  /**
   * 搜索建议 - 热门词 + 用户历史联想
   */
  async suggest(
    keyword: string,
    limit: number = 10,
    userId: bigint | null,
  ): Promise<{ suggestions: string[] }> {
    if (!keyword || keyword.trim().length < 1) {
      return { suggestions: [] }
    }

    const kw = keyword.trim().toLowerCase()
    const suggestions: string[] = []
    const seen = new Set<string>()

    // 1. 热门词匹配（Redis ZSET）
    try {
      const popular = await this.redis.zrange(POPULARITY_KEY, 0, -1, 'WITHSCORES')
      for (let i = 0; i < popular.length; i += 2) {
        const word = popular[i] as string
        if (word.toLowerCase().includes(kw) && !seen.has(word)) {
          suggestions.push(word)
          seen.add(word)
          if (suggestions.length >= limit) break
        }
      }
    } catch {
      // Redis 不可用跳过
    }

    // 2. 用户搜索历史匹配（数据库不可用跳过）
    if (suggestions.length < limit && userId && this.prisma.isAvailable()) {
      try {
        const history = await this.prisma.searchHistory.findMany({
          where: {
            userId,
            query: { contains: kw },
          },
          select: { query: true },
          distinct: ['query'],
          take: limit * 2,
        })
        for (const h of history) {
          if (!seen.has(h.query)) {
            suggestions.push(h.query)
            seen.add(h.query)
            if (suggestions.length >= limit) break
          }
        }
      } catch {
        // 数据库不可用跳过
      }
    }

    // 3. 兜底：Meilisearch 索引中的标题匹配
    if (suggestions.length < limit) {
      try {
        const meili = this.meilisearchService.getClient()
        const result = await meili.index(MEILI_INDEX).search(keyword, {
          limit: 5,
          attributesToRetrieve: ['title'],
        })
        for (const hit of result.hits as Array<{ title: string }>) {
          const title = hit.title?.slice(0, 60)
          if (title && !seen.has(title) && title.toLowerCase().includes(kw)) {
            suggestions.push(title)
            seen.add(title)
            if (suggestions.length >= limit) break
          }
        }
      } catch {
        // Meilisearch 不可用跳过
      }
    }

    return { suggestions: suggestions.slice(0, limit) }
  }
}
