import { PansouProvider } from './pansou.provider'
import { ConfigService } from '@nestjs/config'

describe('PansouProvider', () => {
  let provider: PansouProvider
  let configService: jest.Mocked<ConfigService>

  beforeEach(() => {
    const config: Record<string, unknown> = {
      PANSOU_API_URL: 'https://so.252035.xyz',
      PANSOU_API_KEY: undefined,
      PANSOU_TIMEOUT: 5000,
    }
    configService = {
      get: jest
        .fn()
        .mockImplementation((key: string, defaultValue?: unknown) => config[key] ?? defaultValue),
    } as unknown as jest.Mocked<ConfigService>

    provider = new PansouProvider(configService)
  })

  describe('元数据', () => {
    it('应该有正确的 name', () => {
      expect(provider.name).toBe('pansou')
    })

    it('应该有正确的 displayName', () => {
      expect(provider.displayName).toBe('PanSou 聚合')
    })

    it('应该有正确的 category', () => {
      expect(provider.category).toBe('netdisk')
    })

    it('配置了 PANSOU_API_URL 时应该启用', () => {
      expect(provider.enabled).toBe(true)
    })
  })

  describe('transform - merged_by_type 解析', () => {
    it('应该正确解析 merged_by_type 响应', async () => {
      const mockResponse = {
        code: 0,
        message: 'ok',
        data: {
          total: 2,
          merged_by_type: {
            quark: [
              {
                url: 'https://pan.quark.cn/s/abc123',
                note: '测试资源 1',
                password: '1234',
                datetime: '2024-01-01',
                source: 'tg:channel1',
              },
            ],
            baidu: [
              {
                url: 'https://pan.baidu.com/s/xyz789',
                note: '测试资源 2',
                password: null,
                datetime: '2024-01-02',
                source: 'plugin:panta',
              },
            ],
          },
        },
      }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(mockResponse),
      }) as unknown as typeof fetch

      const results = await provider.search({ keyword: '测试', page: 1, pageSize: 20 })

      expect(results).toHaveLength(2)
      expect(results[0].title).toBe('测试资源 1')
      expect(results[0].url).toBe('https://pan.quark.cn/s/abc123')
      expect(results[0].source).toBe('pansou')
      expect(results[0].fileType).toBe('夸克网盘')
      expect(results[0].resourceMeta?.cloudType).toBe('quark')
      expect(results[0].resourceMeta?.password).toBe('1234')

      expect(results[1].title).toBe('测试资源 2')
      expect(results[1].fileType).toBe('百度网盘')
      expect(results[1].resourceMeta?.cloudType).toBe('baidu')
    })

    it('note 为空时使用网盘类型作为默认标题', async () => {
      const mockResponse = {
        data: {
          merged_by_type: {
            aliyun: [
              {
                url: 'https://pan.aliyun.com/s/test',
                note: '',
              },
            ],
          },
        },
      }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(mockResponse),
      }) as unknown as typeof fetch

      const results = await provider.search({ keyword: '测试', page: 1, pageSize: 20 })
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('阿里云盘 资源')
    })

    it('应该跳过 url 为空的条目', async () => {
      const mockResponse = {
        data: {
          merged_by_type: {
            quark: [
              { url: '', note: '测试空 URL' },
              { url: 'https://pan.quark.cn/s/valid', note: '测试有效' },
            ],
          },
        },
      }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(mockResponse),
      }) as unknown as typeof fetch

      const results = await provider.search({ keyword: '测试', page: 1, pageSize: 20 })
      expect(results).toHaveLength(1)
      expect(results[0].url).toBe('https://pan.quark.cn/s/valid')
    })
  })

  describe('transform - results 数组解析（回退）', () => {
    it('没有 merged_by_type 时应该回退到 results 数组', async () => {
      const mockResponse = {
        data: {
          results: [
            {
              title: '测试资源',
              content: '资源描述',
              channel: 'channel1',
              datetime: '2024-01-01',
              links: [
                { type: 'quark', url: 'https://pan.quark.cn/s/abc', password: '1234' },
                { type: 'baidu', url: 'https://pan.baidu.com/s/xyz' },
              ],
              tags: ['电影', '2024'],
            },
          ],
        },
      }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(mockResponse),
      }) as unknown as typeof fetch

      const results = await provider.search({ keyword: '测试', page: 1, pageSize: 20 })

      expect(results).toHaveLength(2)
      expect(results[0].title).toBe('测试资源')
      expect(results[0].url).toBe('https://pan.quark.cn/s/abc')
      expect(results[0].fileType).toBe('夸克网盘')
      expect(results[1].url).toBe('https://pan.baidu.com/s/xyz')
      expect(results[1].fileType).toBe('百度网盘')
    })

    it('应该跳过没有 links 的 result', async () => {
      const mockResponse = {
        data: {
          results: [
            { title: '测试无链接', links: [] },
            { title: '测试有链接', links: [{ type: 'quark', url: 'https://example.com' }] },
          ],
        },
      }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve(mockResponse),
      }) as unknown as typeof fetch

      const results = await provider.search({ keyword: '测试', page: 1, pageSize: 20 })
      expect(results).toHaveLength(1)
    })
  })

  describe('错误处理', () => {
    it('响应没有 data 字段时返回空数组', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ code: 0, message: 'no data' }),
      }) as unknown as typeof fetch

      const results = await provider.search({ keyword: '测试', page: 1, pageSize: 20 })
      expect(results).toEqual([])
    })

    it('HTTP 错误时返回空数组', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }) as unknown as typeof fetch

      const results = await provider.search({ keyword: '测试', page: 1, pageSize: 20 })
      expect(results).toEqual([])
    })

    it('网络错误时返回空数组', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('Network error')) as unknown as typeof fetch

      const results = await provider.search({ keyword: '测试', page: 1, pageSize: 20 })
      expect(results).toEqual([])
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })
})
