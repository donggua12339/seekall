import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { BusinessException } from '../../common/filters/http-exception.filter'
import { ErrorCode } from '../../common/constants/error-codes'

@Injectable()
export class CollectionService {

  constructor(private readonly prisma: PrismaService) {}

  async list(userId: bigint, page: number = 1, pageSize: number = 20) {
    if (!this.prisma.isAvailable()) return { list: [], total: 0, page, pageSize }
    const [list, total] = await Promise.all([
      this.prisma.collection.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.collection.count({ where: { userId } }),
    ])
    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  async create(userId: bigint, data: { title: string; description?: string; coverUrl?: string; isPublic?: boolean }) {
    if (!this.prisma.isAvailable()) {
      throw new BusinessException(ErrorCode.INTERNAL_ERROR, 503)
    }
    if (!data.title || data.title.length > 128) {
      throw new BusinessException(ErrorCode.PARAM_ERROR, 400, '标题无效（1-128 字符）')
    }
    return this.prisma.collection.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        coverUrl: data.coverUrl,
        isPublic: data.isPublic || false,
      },
    })
  }

  async update(userId: bigint, id: bigint, data: { title?: string; description?: string; coverUrl?: string; isPublic?: boolean }) {
    const collection = await this.prisma.collection.findUnique({ where: { id } })
    if (!collection || collection.userId !== userId) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404, '合集不存在')
    }
    return this.prisma.collection.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.coverUrl !== undefined && { coverUrl: data.coverUrl }),
        ...(data.isPublic !== undefined && { isPublic: data.isPublic }),
      },
    })
  }

  async delete(userId: bigint, id: bigint) {
    const collection = await this.prisma.collection.findUnique({ where: { id } })
    if (!collection || collection.userId !== userId) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404, '合集不存在')
    }
    await this.prisma.collection.delete({ where: { id } })
    return { message: '已删除' }
  }

  async addItem(userId: bigint, collectionId: bigint, item: { resourceUrl: string; title: string; source?: string; fileType?: string }) {
    const collection = await this.prisma.collection.findUnique({ where: { id: collectionId } })
    if (!collection || collection.userId !== userId) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404, '合集不存在')
    }

    try {
      const created = await this.prisma.collectionItem.create({
        data: {
          collectionId,
          resourceUrl: item.resourceUrl,
          title: item.title,
          source: item.source,
          fileType: item.fileType,
        },
      })
      // 更新合集 item_count
      await this.prisma.collection.update({
        where: { id: collectionId },
        data: { itemCount: { increment: 1 } },
      })
      return created
    } catch (err) {
      // 唯一约束冲突 = 已存在
      if (String(err).includes('Unique')) {
        throw new BusinessException(ErrorCode.PARAM_ERROR, 400, '该资源已在合集中')
      }
      throw err
    }
  }

  async removeItem(userId: bigint, collectionId: bigint, itemId: bigint) {
    const collection = await this.prisma.collection.findUnique({ where: { id: collectionId } })
    if (!collection || collection.userId !== userId) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404, '合集不存在')
    }
    await this.prisma.collectionItem.delete({ where: { id: itemId } })
    await this.prisma.collection.update({
      where: { id: collectionId },
      data: { itemCount: { decrement: 1 } },
    })
    return { message: '已移除' }
  }

  async listItems(userId: bigint, collectionId: bigint, page: number = 1, pageSize: number = 20) {
    const collection = await this.prisma.collection.findUnique({ where: { id: collectionId } })
    if (!collection || (collection.userId !== userId && !collection.isPublic)) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404, '合集不存在或无权限')
    }
    const [list, total] = await Promise.all([
      this.prisma.collectionItem.findMany({
        where: { collectionId },
        orderBy: { addedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.collectionItem.count({ where: { collectionId } }),
    ])
    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }
}
