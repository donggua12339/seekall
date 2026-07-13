import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { randomBytes } from 'crypto'

@Injectable()
export class MembershipCodeService {
  private readonly logger = new Logger(MembershipCodeService.name)
  private readonly CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

  constructor(private readonly prisma: PrismaService) {}

  async generateBatch(
    count: number,
    durationDays: number,
    createdById: bigint,
    expiresAt?: Date,
  ) {
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
