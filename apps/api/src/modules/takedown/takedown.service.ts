import { Injectable, Logger, Inject } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { REDIS_CLIENT } from '../../database/redis.module'
import type Redis from 'ioredis'

@Injectable()
export class TakedownService {
  private readonly logger = new Logger(TakedownService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async report(data: {
    reporterEmail: string
    resourceUrl: string
    reason: string
  }) {
    const record = await this.prisma.takedownRecord.create({
      data: {
        reporterEmail: data.reporterEmail,
        resourceUrl: data.resourceUrl,
        reason: data.reason,
        status: 'pending' as const,
      },
    })
    this.logger.log(`Takedown reported: ${data.resourceUrl}`)
    return { message: '举报已提交，将在 24 小时内处理', id: record.id }
  }

  async resolve(id: bigint, resolvedById: bigint, status: 'resolved' | 'rejected') {
    const record = await this.prisma.takedownRecord.update({
      where: { id },
      data: {
        status,
        resolvedAt: new Date(),
        resolvedById,
      },
    })

    // 如果是 resolved，清除相关搜索缓存
    if (status === 'resolved') {
      await this.invalidateSearchCache()
    }

    return record
  }

  async list(page: number, pageSize: number, status?: string) {
    const where = status ? { status: status as 'pending' | 'resolved' | 'rejected' } : {}
    const [list, total] = await Promise.all([
      this.prisma.takedownRecord.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.takedownRecord.count({ where }),
    ])
    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  private async invalidateSearchCache(): Promise<void> {
    // 清除所有搜索缓存（保守策略）
    const keys = await this.redis.keys('search:*')
    if (keys.length > 0) {
      await this.redis.del(...keys)
      this.logger.log(`Invalidated ${keys.length} search cache entries due to takedown`)
    }
  }
}
