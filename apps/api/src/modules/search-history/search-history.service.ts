import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { BusinessException } from '../../common/filters/http-exception.filter'
import { ErrorCode } from '../../common/constants/error-codes'

@Injectable()
export class SearchHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: bigint, page: number, pageSize: number) {
    const [list, total] = await Promise.all([
      this.prisma.searchHistory.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.searchHistory.count({ where: { userId } }),
    ])
    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  async add(userId: bigint, query: string, filters?: unknown, resultCount: number = 0) {
    // 检查容量限制
    const limit = await this.getLimit(userId)
    const count = await this.prisma.searchHistory.count({ where: { userId } })

    if (count >= limit) {
      // 删除最旧的一条
      const oldest = await this.prisma.searchHistory.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      })
      if (oldest) {
        await this.prisma.searchHistory.delete({ where: { id: oldest.id } })
      }
    }

    return this.prisma.searchHistory.create({
      data: {
        userId,
        query,
        filters: filters as never,
        resultCount,
      },
    })
  }

  async delete(userId: bigint, id: bigint) {
    const item = await this.prisma.searchHistory.findUnique({ where: { id } })
    if (!item || item.userId !== userId) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404)
    }
    await this.prisma.searchHistory.delete({ where: { id } })
    return { message: '已删除' }
  }

  async clearAll(userId: bigint) {
    await this.prisma.searchHistory.deleteMany({ where: { userId } })
    return { message: '已清空搜索历史' }
  }

  /**
   * 热门搜索关键词（从 search_logs 统计，而非 search_history）
   * 公开接口，无需登录
   */
  async popular(limit: number = 10) {
    if (!this.prisma.isAvailable()) {
      return { list: [] }
    }

    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const result = await this.prisma.searchLog.groupBy({
      by: ['query'],
      where: {
        createdAt: { gte: since },
        query: { not: '' },
      },
      _count: { query: true },
      orderBy: { _count: { query: 'desc' } },
      take: limit,
    })

    return {
      list: result.map((item) => ({
        query: item.query,
        count: item._count.query,
      })),
    }
  }

  private async getLimit(userId: bigint): Promise<number> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) return 50
    if (user.isPaid) {
      return Number(process.env.USER_SEARCH_HISTORY_PAID || 500)
    }
    return Number(process.env.USER_SEARCH_HISTORY_FREE || 50)
  }
}
