import { MagnetProvider } from './magnet.provider'
import { ConfigService } from '@nestjs/config'

describe('MagnetProvider', () => {
  let provider: MagnetProvider
  let configService: jest.Mocked<ConfigService>

  beforeEach(() => {
    const config: Record<string, unknown> = {
      MAGNET_SITE_URL: 'https://bt4gprx.com',
      MAGNET_TIMEOUT: 5000,
    }
    configService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: unknown) => config[key] ?? defaultValue),
    } as unknown as jest.Mocked<ConfigService>

    provider = new MagnetProvider(configService)
  })

  describe('元数据', () => {
    it('应该有正确的 name', () => {
      expect(provider.name).toBe('magnet')
    })

    it('应该有正确的 displayName', () => {
      expect(provider.displayName).toBe('磁力资源')
    })

    it('应该有正确的 category', () => {
      expect(provider.category).toBe('magnet')
    })

    it('默认应该启用', () => {
      expect(provider.enabled).toBe(true)
    })

    it('MAGNET_SITE_URL 为空字符串时应该禁用', () => {
      configService.get = jest.fn().mockImplementation((key: string) => {
        if (key === 'MAGNET_SITE_URL') return ''
        return undefined
      })
      const p = new MagnetProvider(configService)
      expect(p.enabled).toBe(false)
    })
  })

  describe('parseRss（通过私有方法间接测试）', () => {
    // 通过实际 search 调用测试 RSS 解析
    it('应该正确解析 RSS XML 并提取磁力链接', async () => {
      const mockXml = `<?xml version="1.0" encoding="UTF-8"?>
        <rss version="2.0">
          <channel>
            <item>
              <title>测试资源 1</title>
              <guid>https://bt4gprx.com/torrent/abc123</guid>
              <link>magnet:?xt=urn:btih:abc123def456&amp;dn=test1</link>
              <description>详情<br>1.23 GB<br>其他信息</description>
              <pubDate>Mon, 01 Jan 2024 00:00:00 +0000</pubDate>
            </item>
            <item>
              <title>测试资源 2</title>
              <guid>https://bt4gprx.com/torrent/xyz789</guid>
              <link>magnet:?xt=urn:btih:xyz789ghi012&amp;dn=test2</link>
              <description>详情<br>500 MB<br>其他信息</description>
              <pubDate>Tue, 02 Jan 2024 00:00:00 +0000</pubDate>
            </item>
          </channel>
        </rss>`

      global.fetch = jest.fn().mockResolvedValue({
        ok: true, headers: { get: () => 'application/json' },
        text: () => Promise.resolve(mockXml),
      }) as unknown as typeof fetch

      const results = await provider.search({ keyword: '测试', page: 1, pageSize: 20 })

      expect(results).toHaveLength(2)
      expect(results[0].title).toBe('测试资源 1')
      expect(results[0].url).toMatch(/^magnet:\?xt=urn:btih:abc123def456/)
      expect(results[0].category).toBe('magnet')
      expect(results[0].source).toBe('magnet')
      expect(results[0].fileType).toBe('magnet')
      expect(results[0].fileSize).toBeCloseTo(1.23 * 1024 ** 3, -2)
      expect(results[0].resourceMeta?.magnetHash).toBe('abc123def456')
      expect(results[0].resourceMeta?.detailUrl).toBe('https://bt4gprx.com/torrent/abc123')

      expect(results[1].title).toBe('测试资源 2')
      expect(results[1].fileSize).toBeCloseTo(500 * 1024 ** 2, -2)
    })

    it('应该跳过非磁力链接', async () => {
      const mockXml = `<?xml version="1.0"?>
        <rss><channel>
          <item>
            <title>非磁力资源</title>
            <link>https://example.com/not-magnet</link>
            <description>详情<br>100 MB</description>
          </item>
        </channel></rss>`

      global.fetch = jest.fn().mockResolvedValue({
        ok: true, headers: { get: () => 'application/json' },
        text: () => Promise.resolve(mockXml),
      }) as unknown as typeof fetch

      const results = await provider.search({ keyword: '测试', page: 1, pageSize: 20 })
      expect(results).toHaveLength(0)
    })

    it('应该处理 CDATA 包裹的字段', async () => {
      const mockXml = `<?xml version="1.0"?>
        <rss><channel>
          <item>
            <title><![CDATA[CDATA 测试资源]]></title>
            <link><![CDATA[magnet:?xt=urn:btih:cdata123&dn=test]]></link>
            <description><![CDATA[详情<br>2 GB<br>其他]]></description>
          </item>
        </channel></rss>`

      global.fetch = jest.fn().mockResolvedValue({
        ok: true, headers: { get: () => 'application/json' },
        text: () => Promise.resolve(mockXml),
      }) as unknown as typeof fetch

      const results = await provider.search({ keyword: '测试', page: 1, pageSize: 20 })
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('CDATA 测试资源')
      expect(results[0].fileSize).toBeCloseTo(2 * 1024 ** 3, -2)
    })

    it('应该处理空 XML', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true, headers: { get: () => 'application/json' },
        text: () => Promise.resolve('<?xml version="1.0"?><rss></rss>'),
      }) as unknown as typeof fetch

      const results = await provider.search({ keyword: '测试', page: 1, pageSize: 20 })
      expect(results).toHaveLength(0)
    })
  })

  describe('错误处理', () => {
    it('HTTP 错误时应该返回空数组', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }) as unknown as typeof fetch

      const results = await provider.search({ keyword: '测试', page: 1, pageSize: 20 })
      expect(results).toEqual([])
    })

    it('网络错误时应该返回空数组', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error')) as unknown as typeof fetch

      const results = await provider.search({ keyword: '测试', page: 1, pageSize: 20 })
      expect(results).toEqual([])
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })
})
