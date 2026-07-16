import { ProviderService } from './provider.service'
import { Provider, SearchQuery, SearchResult } from './interfaces/provider.interface'

class MockProvider implements Provider {
  constructor(
    public readonly name: string,
    public readonly displayName: string,
    public readonly category: 'netdisk' | 'magnet' | 'tg' | 'forum',
    public readonly enabled: boolean,
    private readonly results: SearchResult[] = [],
    private readonly shouldFail: boolean = false,
  ) {}

  async search(_query: SearchQuery): Promise<SearchResult[]> {
    if (this.shouldFail) throw new Error(`${this.name} failed`)
    return [...this.results]
  }

  async healthCheck(): Promise<boolean> {
    return this.enabled
  }
}

describe('ProviderService', () => {
  let service: ProviderService

  const buildService = (providers: Provider[]) => {
    service = new ProviderService(providers)
  }

  describe('getActiveProviders', () => {
    it('应该只返回 enabled 的 Provider', () => {
      const p1 = new MockProvider('p1', 'P1', 'netdisk', true)
      const p2 = new MockProvider('p2', 'P2', 'netdisk', false)
      buildService([p1, p2])

      const active = service.getActiveProviders()
      expect(active).toHaveLength(1)
      expect(active[0].name).toBe('p1')
    })
  })

  describe('searchAll', () => {
    it('应该并发调用所有活跃 Provider 并合并结果', async () => {
      const p1 = new MockProvider('p1', 'P1', 'netdisk', true, [
        {
          title: '资源 1',
          url: 'https://a.com/1',
          source: 'p1',
          sourceDisplayName: 'P1',
          category: 'netdisk',
        },
      ])
      const p2 = new MockProvider('p2', 'P2', 'magnet', true, [
        {
          title: '资源 2',
          url: 'https://b.com/2',
          source: 'p2',
          sourceDisplayName: 'P2',
          category: 'magnet',
        },
      ])
      buildService([p1, p2])

      const { results, errors } = await service.searchAll({
        keyword: '测试',
        page: 1,
        pageSize: 20,
      })
      expect(results).toHaveLength(2)
      expect(errors).toHaveLength(0)
    })

    it('单个 Provider 失败时应该降级返回其他结果', async () => {
      const p1 = new MockProvider('p1', 'P1', 'netdisk', true, [
        {
          title: '资源 1',
          url: 'https://a.com/1',
          source: 'p1',
          sourceDisplayName: 'P1',
          category: 'netdisk',
        },
      ])
      const p2 = new MockProvider('p2', 'P2', 'magnet', true, [], true) // shouldFail = true
      buildService([p1, p2])

      const { results, errors } = await service.searchAll({
        keyword: '测试',
        page: 1,
        pageSize: 20,
      })
      expect(results).toHaveLength(1)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toContain('p2')
    })

    it('没有活跃 Provider 时返回空结果', async () => {
      const p1 = new MockProvider('p1', 'P1', 'netdisk', false)
      buildService([p1])

      const { results, errors } = await service.searchAll({
        keyword: '测试',
        page: 1,
        pageSize: 20,
      })
      expect(results).toHaveLength(0)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe('no active provider')
    })

    it('应该按 URL 去重', async () => {
      const p1 = new MockProvider('p1', 'P1', 'netdisk', true, [
        {
          title: '资源 1',
          url: 'https://a.com/1',
          source: 'p1',
          sourceDisplayName: 'P1',
          category: 'netdisk',
        },
        {
          title: '资源 2',
          url: 'https://a.com/1/',
          source: 'p1',
          sourceDisplayName: 'P1',
          category: 'netdisk',
        }, // 尾部斜杠差异，normalize 后相同
      ])
      buildService([p1])

      const { results } = await service.searchAll({ keyword: '测试', page: 1, pageSize: 20 })
      expect(results).toHaveLength(1)
    })

    it('应该返回耗时', async () => {
      const p1 = new MockProvider('p1', 'P1', 'netdisk', true, [
        {
          title: '资源 1',
          url: 'https://a.com/1',
          source: 'p1',
          sourceDisplayName: 'P1',
          category: 'netdisk',
        },
      ])
      buildService([p1])

      const { durationMs } = await service.searchAll({ keyword: '测试', page: 1, pageSize: 20 })
      expect(durationMs).toBeGreaterThanOrEqual(0)
      expect(typeof durationMs).toBe('number')
    })
  })

  describe('healthCheckAll', () => {
    it('应该返回所有 Provider 的健康状态', async () => {
      const p1 = new MockProvider('p1', 'P1', 'netdisk', true)
      const p2 = new MockProvider('p2', 'P2', 'magnet', true, [], true) // shouldFail 只影响 search，不影响 healthCheck
      buildService([p1, p2])

      const health = await service.healthCheckAll()
      // healthCheck 返回 enabled 值，与 search 的 shouldFail 无关
      expect(health.p1).toBe(true)
      expect(health.p2).toBe(true)
    })
  })
})
