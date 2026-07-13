import { QuarkProvider } from './quark.provider'
import { ConfigService } from '@nestjs/config'

describe('QuarkProvider', () => {
  let provider: QuarkProvider
  let configService: jest.Mocked<ConfigService>

  beforeEach(() => {
    const config: Record<string, unknown> = {
      PANSOU_API_URL: 'https://so.252035.xyz',
      QUARK_COOKIE: undefined,
      QUARK_TIMEOUT: 5000,
      QUARK_PANSOU_PLUGIN: 'qupansou',
    }
    configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: unknown) => config[key] ?? defaultValue),
    } as unknown as jest.Mocked<ConfigService>

    provider = new QuarkProvider(configService)
  })

  describe('元数据', () => {
    it('应该有正确的 name', () => {
      expect(provider.name).toBe('quark')
    })

    it('应该有正确的 displayName', () => {
      expect(provider.displayName).toBe('夸克网盘')
    })

    it('应该有正确的 category', () => {
      expect(provider.category).toBe('netdisk')
    })

    it('PANSOU_API_URL 配置时应该启用', () => {
      expect(provider.enabled).toBe(true)
    })
  })

  describe('transform - merged_by_type 解析', () => {
    it('应该从 merged_by_type.quark 提取夸克资源', async () => {
      const mockResponse = {
        data: {
          merged_by_type: {
            quark: [
              {
                url: 'https://pan.quark.cn/s/abc123',
                note: '夸克资源 1',
                password: '1234',
                datetime: '2024-01-01',
                source: 'plugin:qupansou',
              },
              {
                url: 'https://pan.quark.cn/s/def456',
                note: '夸克资源 2',
                password: null,
                datetime: '2024-01-02',
              },
            ],
            baidu: [
              {
                url: 'https://pan.baidu.com/s/should-be-filtered',
                note: '不应出现',
              },
            ],
          },
        },
      }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }) as unknown as typeof fetch

      const results = await provider.search({ keyword: '测试', page: 1, pageSize: 20 })

      // 应该只返回夸克结果，过滤掉 baidu
      expect(results).toHaveLength(2)
      expect(results[0].title).toBe('夸克资源 1')
      expect(results[0].url).toBe('https://pan.quark.cn/s/abc123')
      expect(results[0].fileType).toBe('夸克网盘')
      expect(results[0].source).toBe('quark')
      expect(results[0].resourceMeta?.cloudType).toBe('quark')
      expect(results[0].resourceMeta?.password).toBe('1234')

      expect(results[1].title).toBe('夸克资源 2')
    })

    it('note 为空时使用默认标题', async () => {
      const mockResponse = {
        data: {
          merged_by_type: {
            quark: [{ url: 'https://pan.quark.cn/s/test', note: '' }],
          },
        },
      }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }) as unknown as typeof fetch

      const results = await provider.search({ keyword: '测试', page: 1, pageSize: 20 })
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('夸克网盘资源')
    })

    it('应该跳过 url 为空的条目', async () => {
      const mockResponse = {
        data: {
          merged_by_type: {
            quark: [
              { url: '', note: '空' },
              { url: 'https://pan.quark.cn/s/valid', note: '有效' },
            ],
          },
        },
      }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }) as unknown as typeof fetch

      const results = await provider.search({ keyword: '测试', page: 1, pageSize: 20 })
      expect(results).toHaveLength(1)
    })
  })

  describe('transform - results 数组回退', () => {
    it('merged_by_type 无 quark 时回退到 results', async () => {
      const mockResponse = {
        data: {
          results: [
            {
              title: '夸克资源',
              datetime: '2024-01-01',
              links: [
                { type: 'quark', url: 'https://pan.quark.cn/s/abc', password: '1234' },
                { type: 'baidu', url: 'https://pan.baidu.com/s/xyz' }, // 应被过滤
              ],
            },
          ],
        },
      }

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      }) as unknown as typeof fetch

      const results = await provider.search({ keyword: '测试', page: 1, pageSize: 20 })
      expect(results).toHaveLength(1)
      expect(results[0].url).toBe('https://pan.quark.cn/s/abc')
      expect(results[0].fileType).toBe('夸克网盘')
    })
  })

  describe('错误处理', () => {
    it('HTTP 错误时返回空数组', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }) as unknown as typeof fetch

      const results = await provider.search({ keyword: '测试', page: 1, pageSize: 20 })
      expect(results).toEqual([])
    })

    it('网络错误时返回空数组', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch

      const results = await provider.search({ keyword: '测试', page: 1, pageSize: 20 })
      expect(results).toEqual([])
    })

    it('响应无 data 字段时返回空数组', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ code: 0 }),
      }) as unknown as typeof fetch

      const results = await provider.search({ keyword: '测试', page: 1, pageSize: 20 })
      expect(results).toEqual([])
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })
})
