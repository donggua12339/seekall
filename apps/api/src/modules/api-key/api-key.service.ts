import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { BusinessException } from '../../common/filters/http-exception.filter'
import { ErrorCode } from '../../common/constants/error-codes'
import { createHash, randomBytes } from 'crypto'

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 生成新 API Key
   * 格式：sk_<32位随机hex>
   * 存储：仅存 hash（SHA-256），不存明文
   */
  async create(userId: bigint, name: string): Promise<{ key: string; id: bigint; prefix: string }> {
    if (!this.prisma.isAvailable()) {
      throw new BusinessException(ErrorCode.INTERNAL_ERROR, 503)
    }

    if (!name || name.length > 64) {
      throw new BusinessException(ErrorCode.PARAM_ERROR, 400, 'API Key 名称无效（1-64 字符）')
    }

    // 检查用户已有 Key 数量（最多 5 个）
    const count = await this.prisma.apiKey.count({
      where: { userId, revokedAt: null },
    })
    if (count >= 5) {
      throw new BusinessException(ErrorCode.PARAM_ERROR, 400, '每个用户最多 5 个有效 API Key')
    }

    // 生成明文 key
    const rawKey = `sk_${randomBytes(16).toString('hex')}`
    const keyHash = this.hashKey(rawKey)
    const prefix = rawKey.slice(0, 11) // sk_ + 前 8 位

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        keyHash,
        name,
        prefix,
      },
    })

    this.logger.log(`API Key created: user ${userId}, name "${name}", prefix ${prefix}`)

    return { key: rawKey, id: apiKey.id, prefix }
  }

  /**
   * 列出用户所有 API Key（不返回明文）
   */
  async list(userId: bigint) {
    if (!this.prisma.isAvailable()) return []
    return this.prisma.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        prefix: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
      },
    })
  }

  /**
   * 撤销 API Key
   */
  async revoke(userId: bigint, id: bigint): Promise<{ message: string }> {
    if (!this.prisma.isAvailable()) {
      throw new BusinessException(ErrorCode.INTERNAL_ERROR, 503)
    }

    const apiKey = await this.prisma.apiKey.findUnique({ where: { id } })
    if (!apiKey || apiKey.userId !== userId) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404, 'API Key 不存在')
    }
    if (apiKey.revokedAt) {
      return { message: 'API Key 已撤销' }
    }

    await this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    })

    this.logger.log(`API Key revoked: user ${userId}, id ${id}`)
    return { message: 'API Key 已撤销' }
  }

  /**
   * 验证 API Key（通过明文 key 查找用户）
   * 返回 userId，未找到返回 null
   */
  async validate(rawKey: string): Promise<{ userId: bigint; apiKeyId: bigint } | null> {
    if (!this.prisma.isAvailable()) return null
    if (!rawKey.startsWith('sk_') || rawKey.length < 10) return null

    const keyHash = this.hashKey(rawKey)
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { keyHash },
    })

    if (!apiKey || apiKey.revokedAt) return null

    // 更新最后使用时间（异步，不阻塞）
    this.prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {
        // 更新失败不影响验证
      })

    return { userId: apiKey.userId, apiKeyId: apiKey.id }
  }

  private hashKey(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex')
  }
}
