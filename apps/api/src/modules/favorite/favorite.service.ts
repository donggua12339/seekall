import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { BusinessException } from '../../common/filters/http-exception.filter'
import { ErrorCode } from '../../common/constants/error-codes'

@Injectable()
export class FavoriteService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: bigint, page: number, pageSize: number, collectionId?: bigint) {
    const where = collectionId
      ? { userId, collectionId }
      : { userId }
    const [list, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { collection: { select: { name: true } } },
      }),
      this.prisma.favorite.count({ where }),
    ])
    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  async add(userId: bigint, data: {
    resourceUrl: string
    title: string
    source: string
    category?: string
    resourceMeta?: unknown
    collectionId?: bigint
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
          collectionId: data.collectionId ?? null,
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

  async moveToCollection(userId: bigint, id: bigint, collectionId: bigint | null) {
    const item = await this.prisma.favorite.findUnique({ where: { id } })
    if (!item || item.userId !== userId) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404)
    }
    return this.prisma.favorite.update({
      where: { id },
      data: { collectionId },
    })
  }

  // ====== 收藏夹分组 CRUD ======

  async listCollections(userId: bigint) {
    const [collections, _defaultCount] = await Promise.all([
      this.prisma.favoriteCollection.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { favorites: true } } },
      }),
      this.prisma.favorite.count({ where: { userId, collectionId: null } }),
    ])
    return {
      collections: collections.map((c) => ({
        id: c.id.toString(),
        name: c.name,
        count: c._count.favorites,
        createdAt: c.createdAt,
      })),
      defaultCount: _defaultCount,
    }
  }

  async createCollection(userId: bigint, name: string) {
    if (!name || !name.trim()) {
      throw new BusinessException(ErrorCode.PARAM_ERROR, 400, '分组名称不能为空')
    }
    try {
      const collection = await this.prisma.favoriteCollection.create({
        data: { userId, name: name.trim() },
      })
      return { id: collection.id.toString(), name: collection.name }
    } catch (err) {
      if ((err as { code?: string }).code === 'P2002') {
        throw new BusinessException(ErrorCode.PARAM_ERROR, 400, '分组名称已存在')
      }
      throw err
    }
  }

  async deleteCollection(userId: bigint, id: bigint) {
    const collection = await this.prisma.favoriteCollection.findUnique({ where: { id } })
    if (!collection || collection.userId !== userId) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404)
    }
    // 收藏项的 collectionId 设为 null（移到默认分组）
    await this.prisma.favoriteCollection.delete({ where: { id } })
    return { message: '分组已删除，收藏项已移到默认分组' }
  }
}
