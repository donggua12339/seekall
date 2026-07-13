import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { BusinessException } from '../../common/filters/http-exception.filter'
import { ErrorCode } from '../../common/constants/error-codes'

@Injectable()
export class FavoriteService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: bigint, page: number, pageSize: number) {
    const [list, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.favorite.count({ where: { userId } }),
    ])
    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  async add(userId: bigint, data: {
    resourceUrl: string
    title: string
    source: string
    category?: string
    resourceMeta?: unknown
  }) {
    try {
      return await this.prisma.favorite.create({
        data: {
          userId,
          resourceUrl: data.resourceUrl,
          title: data.title,
          source: data.source,
          category: data.category,
          resourceMeta: data.resourceMeta as never,
        },
      })
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new BusinessException(ErrorCode.FAVORITE_EXISTS)
      }
      throw err
    }
  }

  async delete(userId: bigint, id: bigint) {
    const item = await this.prisma.favorite.findUnique({ where: { id } })
    if (!item || item.userId !== userId) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404)
    }
    await this.prisma.favorite.delete({ where: { id } })
    return { message: '已取消收藏' }
  }
}
