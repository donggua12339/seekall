import { UrlUtil } from './url.util'

describe('UrlUtil', () => {
  describe('hash', () => {
    it('应该对相同 URL 返回相同 hash', () => {
      const url = 'https://example.com/resource/123'
      expect(UrlUtil.hash(url)).toBe(UrlUtil.hash(url))
    })

    it('应该对不同 URL 返回不同 hash', () => {
      expect(UrlUtil.hash('https://a.com/1')).not.toBe(UrlUtil.hash('https://b.com/2'))
    })

    it('应该返回 32 位 md5 hex', () => {
      const hash = UrlUtil.hash('https://example.com')
      expect(hash).toHaveLength(32)
      expect(hash).toMatch(/^[a-f0-9]+$/)
    })
  })

  describe('normalize', () => {
    it('应该去除尾部斜杠', () => {
      expect(UrlUtil.normalize('https://example.com/')).toBe('https://example.com')
      expect(UrlUtil.normalize('https://example.com/path/')).toBe('https://example.com/path')
    })

    it('应该去除前后空白', () => {
      expect(UrlUtil.normalize('  https://example.com  ')).toBe('https://example.com')
    })

    it('不应该影响无尾部斜杠的 URL', () => {
      expect(UrlUtil.normalize('https://example.com/path')).toBe('https://example.com/path')
    })
  })
})
