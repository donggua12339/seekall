import { SearchService } from './search.service'
import { BusinessException } from '../../common/filters/http-exception.filter'

describe('SearchService', () => {
  let service: SearchService
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let providerService: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let meilisearchService: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let configService: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let redis: any

  beforeEach(() => {
    providerService = {
      searchAll: jest.fn(),
      getActiveProviders: jest.fn().mockReturnValue([
        { name: 'pansou' },
        { name: 'magnet' },
      ]),
    }
    prisma = {
      isAvailable: jest.fn().mockReturnValue(true),
      blockedKeyword: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      takedownRecord: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      linkStatusRecord: {
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn().mockResolvedValue({}),
      },
      searchLog: {
        create: jest.fn().mockResolvedValue({}),
        groupBy: jest.fn().mockResolvedValue([]),
      },
    }
    meilisearchService = {
      ensureIndex: jest.fn().mockResolvedValue(undefined),
      getClient: jest.fn().mockReturnValue({
        index: jest.fn().mockReturnValue({
          addDocuments: jest.fn().mockResolvedValue(undefined),
          search: jest.fn().mockResolvedValue({
            hits: [],
            totalHits: 0,
            processingTimeMs: 1,
          }),
        }),
      }),
    }
    configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: unknown) => {
        const config: Record<string, unknown> = {
          SEARCH_CACHE_TTL: 3600,
          SEARCH_MAX_PAGE_SIZE: 50,
          SEARCH_DEFAULT_PAGE_SIZE: 20,
        }
        return config[key] ?? defaultValue
      }),
    }
    redis = {
      get: jest.fn().mockResolvedValue(null),
      setex: jest.fn().mockResolvedValue('OK'),
      zscore: jest.fn().mockResolvedValue(null),
      multi: jest.fn().mockReturnValue({
        zincrby: jest.fn(),
        expire: jest.fn(),
        exec: jest.fn().mockResolvedValue([]),
      }),
    }

    service = new SearchService(
      providerService,
      prisma,
      meilisearchService,
      configService,
      redis,
    )
  })

  describe('search - 参数校验', () => {
    it('空关键词应抛异常', async () => {
      await expect(
        service.search({ keyword: '', page: 1, pageSize: 20 }, null),
      ).rejects.toThrow(BusinessException)
    })

    it('纯空格关键词应抛异常', async () => {
      await expect(
        service.search({ keyword: '   ', page: 1, pageSize: 20 }, null),
      ).rejects.toThrow(BusinessException)
    })

    it('关键词超过 100 字符应抛异常', async () => {
      await expect(
        service.search({ keyword: 'a'.repeat(101), page: 1, pageSize: 20 }, null),
      ).rejects.toThrow(BusinessException)
    })
  })

  describe('search - 正常流程', () => {
    it('应该返回 Provider 聚合结果', async () => {
      providerService.searchAll.mockResolvedValue({
        results: [
          {
            title: '测试资源',
            url: 'https://pan.quark.cn/s/test',
            source: 'pansou',
            sourceDisplayName: 'PanSou',
            category: 'netdisk',
            fileType: '夸克网盘',
          },
        ],
        errors: [],
        durationMs: 1000,
      })

      const result = await service.search(
        { keyword: '测试', page: 1, pageSize: 20 },
        null,
      )

      expect(result.total).toBe(1)
      expect(result.list[0].title).toBe('测试资源')
      expect(result.providers).toEqual(['pansou', 'magnet'])
    })

    it('应该缓存有结果的结果集', async () => {
      providerService.searchAll.mockResolvedValue({
        results: [
          {
            title: '测试',
            url: 'https://example.com/1',
            source: 'pansou',
            sourceDisplayName: 'PanSou',
            category: 'netdisk',
          },
        ],
        errors: [],
        durationMs: 500,
      })

      await service.search({ keyword: '测试', page: 1, pageSize: 20 }, null)
      expect(redis.setex).toHaveBeenCalled()
    })

    it('空结果不缓存（防穿透用短 TTL）', async () => {
      providerService.searchAll.mockResolvedValue({
        results: [],
        errors: [],
        durationMs: 500,
      })

      await service.search({ keyword: '空结果测试', page: 1, pageSize: 20 }, null)
      // 空结果用 CACHE_TTL_EMPTY = 30s
      expect(redis.setex).toHaveBeenCalledWith(
        expect.any(String),
        30,
        expect.any(String),
      )
    })

    it('缓存命中时直接返回缓存结果', async () => {
      const cached = {
        list: [{ title: '缓存结果', url: 'https://cached.com' }],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        durationMs: 100,
        providers: ['pansou'],
        errors: [],
      }
      redis.get.mockResolvedValue(JSON.stringify(cached))

      const result = await service.search(
        { keyword: '缓存测试', page: 1, pageSize: 20 },
        null,
      )

      expect(result.total).toBe(1)
      expect(result.list[0].title).toBe('缓存结果')
      expect(providerService.searchAll).not.toHaveBeenCalled()
    })
  })

  describe('search - 分页', () => {
    it('pageSize 超过最大值应限制为 50', async () => {
      providerService.searchAll.mockResolvedValue({
        results: [],
        errors: [],
        durationMs: 100,
      })

      await service.search({ keyword: '测试', page: 1, pageSize: 100 }, null)
      // ProviderService 应收到限制后的 pageSize
      expect(providerService.searchAll).toHaveBeenCalledWith(
        expect.objectContaining({ pageSize: 50 }),
      )
    })

    it('page 小于 1 应修正为 1', async () => {
      providerService.searchAll.mockResolvedValue({
        results: [],
        errors: [],
        durationMs: 100,
      })

      await service.search({ keyword: '测试', page: -1, pageSize: 20 }, null)
      expect(providerService.searchAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 }),
      )
    })
  })

  describe('search - 降级', () => {
    it('数据库不可用时仍能搜索', async () => {
      prisma.isAvailable.mockReturnValue(false)
      providerService.searchAll.mockResolvedValue({
        results: [
          {
            title: '测试',
            url: 'https://example.com',
            source: 'pansou',
            sourceDisplayName: 'PanSou',
            category: 'netdisk',
          },
        ],
        errors: [],
        durationMs: 500,
      })

      const result = await service.search(
        { keyword: '测试', page: 1, pageSize: 20 },
        null,
      )

      expect(result.total).toBe(1)
    })

    it('Redis 不可用时仍能搜索', async () => {
      redis.get.mockRejectedValue(new Error('Redis down'))
      redis.setex.mockRejectedValue(new Error('Redis down'))
      providerService.searchAll.mockResolvedValue({
        results: [
          {
            title: '测试',
            url: 'https://example.com',
            source: 'pansou',
            sourceDisplayName: 'PanSou',
            category: 'netdisk',
          },
        ],
        errors: [],
        durationMs: 500,
      })

      const result = await service.search(
        { keyword: '测试', page: 1, pageSize: 20 },
        null,
      )

      expect(result.total).toBe(1)
    })
  })

  describe('fuzzySearch', () => {
    it('应该从 Meilisearch 索引查询', async () => {
      meilisearchService.getClient.mockReturnValue({
        index: jest.fn().mockReturnValue({
          search: jest.fn().mockResolvedValue({
            hits: [
              {
                title: '模糊结果',
                url: 'https://fuzzy.com',
                source: 'pansou',
                sourceDisplayName: 'PanSou',
                category: 'netdisk',
                fileType: '夸克网盘',
              },
            ],
            totalHits: 1,
            processingTimeMs: 1,
          }),
        }),
      })

      const result = await service.fuzzySearch('模糊', 1, 20)
      expect(result.total).toBe(1)
      expect(result.list[0].title).toBe('模糊结果')
      expect(result.fromIndex).toBe(true)
    })
  })

  describe('warmupPopularKeywords', () => {
    it('数据库不可用时返回 0', async () => {
      prisma.isAvailable.mockReturnValue(false)
      const result = await service.warmupPopularKeywords(20)
      expect(result.total).toBe(0)
    })

    it('应该对热门关键词预缓存', async () => {
      prisma.searchLog.groupBy.mockResolvedValue([
        { query: '三体', _count: { query: 10 } },
        { query: '流浪地球', _count: { query: 5 } },
      ])
      providerService.searchAll.mockResolvedValue({
        results: [
          {
            title: '测试',
            url: 'https://example.com',
            source: 'pansou',
            sourceDisplayName: 'PanSou',
            category: 'netdisk',
          },
        ],
        errors: [],
        durationMs: 500,
      })

      const result = await service.warmupPopularKeywords(20)
      expect(result.total).toBe(2)
      expect(result.succeeded).toBe(2)
    })
  })
})
