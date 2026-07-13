import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

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
    await this.prisma.blockedKeyword.delete({ where: { id } })
    return { message: '已删除' }
  }
}
