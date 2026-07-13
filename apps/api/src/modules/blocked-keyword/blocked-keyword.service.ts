import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { BusinessException } from '../../common/filters/http-exception.filter'
import { ErrorCode } from '../../common/constants/error-codes'

@Injectable()
export class BlockedKeywordService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page: number, pageSize: number) {
    const [list, total] = await Promise.all([
      this.prisma.blockedKeyword.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { createdBy: { select: { username: true } } },
      }),
      this.prisma.blockedKeyword.count(),
    ])
    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  async add(keyword: string, category: string | undefined, createdById: bigint) {
    return this.prisma.blockedKeyword.create({
      data: { keyword, category, createdById },
    })
  }

  async delete(id: bigint) {
    const keyword = await this.prisma.blockedKeyword.findUnique({ where: { id } })
    if (!keyword) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404)
    }
    await this.prisma.blockedKeyword.delete({ where: { id } })
    return { message: '已删除' }
  }
}
