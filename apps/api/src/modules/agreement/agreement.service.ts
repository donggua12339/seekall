import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

@Injectable()
export class AgreementService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent() {
    return this.prisma.agreement.findFirst({
      orderBy: { effectiveDate: 'desc' },
    })
  }

  async getByVersion(version: string) {
    return this.prisma.agreement.findUnique({ where: { version } })
  }

  async create(data: { version: string; content: string; effectiveDate: Date }, _createdById: bigint) {
    return this.prisma.agreement.create({
      data: {
        version: data.version,
        content: data.content,
        effectiveDate: data.effectiveDate,
      },
    })
  }
}
