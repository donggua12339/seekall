import { InviteCodeUtil } from './invite-code.util'

describe('InviteCodeUtil', () => {
  describe('generate', () => {
    it('应该生成指定长度的邀请码', () => {
      const code = InviteCodeUtil.generate(8)
      expect(code).toHaveLength(8)
    })

    it('应该生成 16 位邀请码', () => {
      const code = InviteCodeUtil.generate(16)
      expect(code).toHaveLength(16)
    })

    it('应该只使用允许的字符集', () => {
      const allowed = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
      for (let i = 0; i < 100; i++) {
        const code = InviteCodeUtil.generate(8)
        for (const ch of code) {
          expect(allowed).toContain(ch)
        }
      }
    })

    it('不应该包含歧义字符 0/O/1/I/L', () => {
      for (let i = 0; i < 100; i++) {
        const code = InviteCodeUtil.generate(8)
        expect(code).not.toMatch(/[0O1IL]/)
      }
    })

    it('每次生成的邀请码应该高度随机', () => {
      const codes = new Set<string>()
      for (let i = 0; i < 1000; i++) {
        codes.add(InviteCodeUtil.generate(8))
      }
      // 1000 个 32^8 组合空间，碰撞概率极低
      expect(codes.size).toBeGreaterThan(990)
    })
  })

  describe('generateBatch', () => {
    it('应该生成指定数量的唯一邀请码', () => {
      const codes = InviteCodeUtil.generateBatch(50, 8)
      expect(codes).toHaveLength(50)
      expect(new Set(codes).size).toBe(50)
    })

    it('应该支持 16 位长度', () => {
      const codes = InviteCodeUtil.generateBatch(10, 16)
      expect(codes).toHaveLength(10)
      codes.forEach((c) => expect(c).toHaveLength(16))
    })
  })

  describe('isValidFormat', () => {
    it('应该接受有效的 8 位邀请码', () => {
      expect(InviteCodeUtil.isValidFormat('K7M2P9XQ')).toBe(true)
      expect(InviteCodeUtil.isValidFormat('ABCDEFGH')).toBe(true)
      expect(InviteCodeUtil.isValidFormat('23456789')).toBe(true)
    })

    it('应该拒绝包含歧义字符的邀请码', () => {
      expect(InviteCodeUtil.isValidFormat('K7M2P9X0')).toBe(false) // 含 0
      expect(InviteCodeUtil.isValidFormat('K7M2P9XO')).toBe(false) // 含 O
      expect(InviteCodeUtil.isValidFormat('K7M2P9X1')).toBe(false) // 含 1
      expect(InviteCodeUtil.isValidFormat('K7M2P9XI')).toBe(false) // 含 I
      expect(InviteCodeUtil.isValidFormat('K7M2P9XL')).toBe(false) // 含 L
    })

    it('应该拒绝长度不正确的邀请码', () => {
      expect(InviteCodeUtil.isValidFormat('K7M2P9X')).toBe(false) // 7 位
      expect(InviteCodeUtil.isValidFormat('K7M2P9XQQ')).toBe(false) // 9 位
      expect(InviteCodeUtil.isValidFormat('')).toBe(false)
    })

    it('应该拒绝包含小写字母的邀请码', () => {
      expect(InviteCodeUtil.isValidFormat('k7m2p9xq')).toBe(false)
    })
  })
})
