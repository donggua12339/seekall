import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { InviteCodeUtil } from '../../common/utils/invite-code.util'
import { BusinessException } from '../../common/filters/http-exception.filter'
import { ErrorCode } from '../../common/constants/error-codes'

@Injectable()
export class InviteCodeService {
  private readonly logger = new Logger(InviteCodeService.name)

  constructor(private readonly prisma: PrismaService) {}

  async generateBatch(count: number, createdById: bigint, expiresAt?: Date) {
    const codes = InviteCodeUtil.generateBatch(count, 8)
    const created = await this.prisma.$transaction(
      codes.map((code) =>
        this.prisma.inviteCode.create({
          data: {
            code,
            createdById,
            expiresAt,
          },
        }),
      ),
    )
    this.logger.log(`Generated ${created.length} invite codes by user ${createdById}`)
    return created
  }

  async list(page: number, pageSize: number, status?: string) {
    const where = status ? { status: status as 'unused' | 'used' | 'disabled' } : {}
    const [list, total] = await Promise.all([
      this.prisma.inviteCode.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          createdBy: { select: { username: true } },
          usedBy: { select: { username: true } },
        },
      }),
      this.prisma.inviteCode.count({ where }),
    ])
    return {
      list,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  async disable(id: bigint) {
    const code = await this.prisma.inviteCode.findUnique({ where: { id } })
    if (!code) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404)
    }
    if (code.status === 'used') {
      throw new BusinessException(ErrorCode.INVITE_CODE_USED)
    }
    return this.prisma.inviteCode.update({
      where: { id },
      data: { status: 'disabled' as const },
    })
  }

  async exportUnused(createdById: bigint): Promise<{ code: string; createdAt: Date }[]> {
    const codes = await this.prisma.inviteCode.findMany({
      where: { status: 'unused', createdById },
      select: { code: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
    return codes
  }
}
