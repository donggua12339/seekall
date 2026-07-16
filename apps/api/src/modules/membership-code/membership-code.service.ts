import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { BusinessException } from '../../common/filters/http-exception.filter'
import { ErrorCode } from '../../common/constants/error-codes'
import { randomBytes } from 'crypto'

@Injectable()
export class MembershipCodeService {
  private readonly logger = new Logger(MembershipCodeService.name)
  private readonly CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

  constructor(private readonly prisma: PrismaService) {}

  async generateBatch(count: number, durationDays: number, createdById: bigint, expiresAt?: Date) {
    if (count < 1 || count > 1000) {
      throw new BusinessException(ErrorCode.PARAM_ERROR, 400, '数量必须在 1-1000 之间')
    }
    if (durationDays < 1) {
      throw new BusinessException(ErrorCode.PARAM_ERROR, 400, '天数必须大于 0')
    }
    const codes: string[] = []
    while (codes.length < count) {
      const code = this.generate(16)
      codes.push(code)
    }

    const created = await this.prisma.$transaction(
      codes.map((code) =>
        this.prisma.membershipCode.create({
          data: { code, durationDays, createdById, expiresAt },
        }),
      ),
    )
    this.logger.log(`Generated ${created.length} membership codes by user ${createdById}`)
    return created
  }

  private generate(length: number): string {
    const bytes = randomBytes(length)
    let result = ''
    for (let i = 0; i < length; i++) {
      result += this.CHARSET[bytes[i] % this.CHARSET.length]
    }
    return result
  }

  async list(page: number, pageSize: number, status?: string) {
    const where = status ? { status: status as 'unused' | 'used' | 'disabled' } : {}
    const [list, total] = await Promise.all([
      this.prisma.membershipCode.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          createdBy: { select: { username: true } },
          usedBy: { select: { username: true } },
        },
      }),
      this.prisma.membershipCode.count({ where }),
    ])
    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  async disable(id: bigint) {
    const code = await this.prisma.membershipCode.findUnique({ where: { id } })
    if (!code) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404)
    }
    if (code.status === 'used') {
      throw new BusinessException(ErrorCode.PARAM_ERROR, 400, '激活码已使用')
    }
    if (code.status === 'disabled') {
      throw new BusinessException(ErrorCode.PARAM_ERROR, 400, '激活码已禁用')
    }
    return this.prisma.membershipCode.update({
      where: { id },
      data: { status: 'disabled' as const },
    })
  }

  async exportUnused(createdById: bigint) {
    return this.prisma.membershipCode.findMany({
      where: { status: 'unused', createdById },
      select: { code: true, durationDays: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })
  }
}
