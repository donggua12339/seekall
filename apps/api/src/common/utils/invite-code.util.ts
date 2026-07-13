import { randomBytes } from 'crypto'

// 去除歧义字符的 base32 字符集（无 0/O/1/I/L）
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export class InviteCodeUtil {
  static generate(length: number = 8): string {
    const bytes = randomBytes(length)
    let result = ''
    for (let i = 0; i < length; i++) {
      result += CHARSET[bytes[i] % CHARSET.length]
    }
    return result
  }

  static generateBatch(count: number, length: number = 8): string[] {
    const codes = new Set<string>()
    while (codes.size < count) {
      codes.add(this.generate(length))
    }
    return Array.from(codes)
  }

  static isValidFormat(code: string): boolean {
    return new RegExp(`^[${CHARSET}]{8}$`).test(code)
  }
}
