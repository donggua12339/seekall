import * as argon2 from 'argon2'

export class HashUtil {
  static async hash(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536, // 64 MB
      timeCost: 3,
      parallelism: 4,
    })
  }

  static async verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password)
  }

  static async randomToken(bytes: number = 32): Promise<string> {
    const { randomBytes } = await import('crypto')
    return randomBytes(bytes).toString('hex')
  }
}
