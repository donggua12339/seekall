import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { RuleRiskLevel, RuleStatus } from '@prisma/client'

// 风险级别数字到 enum 的映射
const RISK_LEVEL_MAP: Record<number, RuleRiskLevel> = {
  0: RuleRiskLevel.l0,
  1: RuleRiskLevel.l1,
  2: RuleRiskLevel.l2,
  3: RuleRiskLevel.l3,
  4: RuleRiskLevel.l4,
}

@Injectable()
export class RuleService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 列出规则市场所有规则
   * - L0/L1: 所有人可见
   * - L2: 会员可见
   * - L3/L4: 仅 admin 可见
   */
  async list(
    options: {
      page?: number
      pageSize?: number
      riskLevel?: number
      actorRole?: string
    } = {},
  ) {
    const page = options.page || 1
    const pageSize = options.pageSize || 20
    const actorRole = options.actorRole || 'user'

    // 非 admin 只能看 L0-L2
    const maxRiskNum = actorRole === 'super_admin' ? 4 : 2
    const maxRisk = RISK_LEVEL_MAP[maxRiskNum]

    const where: Record<string, unknown> = {
      status: RuleStatus.published,
      riskLevel: { lte: maxRisk },
    }
    if (options.riskLevel !== undefined) {
      where.riskLevel = RISK_LEVEL_MAP[options.riskLevel]
    }

    const [list, total] = await Promise.all([
      this.prisma.rule.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.rule.count({ where }),
    ])

    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  async get(id: bigint) {
    const rule = await this.prisma.rule.findUnique({ where: { id } })
    if (!rule) throw new NotFoundException('Rule not found')
    return rule
  }

  /**
   * 提交新规则到市场（需 ¥18 月卡及以上）
   * L0/L1: 自动入库 + admin 抽查
   * L2: 入暂存区 + 社群评审
   */
  async submit(input: {
    npmPackage: string
    riskLevel: number
    description: string
    authorId: bigint
  }) {
    const status = input.riskLevel <= 1 ? RuleStatus.published : RuleStatus.pending_review
    return this.prisma.rule.create({
      data: {
        npmPackage: input.npmPackage,
        riskLevel: RISK_LEVEL_MAP[input.riskLevel],
        description: input.description,
        authorId: input.authorId,
        status,
      },
    })
  }

  /**
   * L3/L4 规则仅 admin 可创建
   */
  async adminCreate(input: {
    npmPackage: string
    riskLevel: number
    description: string
    adminId: bigint
  }) {
    if (input.riskLevel < 3) {
      throw new Error('adminCreate 仅用于 L3/L4 规则')
    }
    return this.prisma.rule.create({
      data: {
        npmPackage: input.npmPackage,
        riskLevel: RISK_LEVEL_MAP[input.riskLevel],
        description: input.description,
        authorId: input.adminId,
        status: RuleStatus.published,
      },
    })
  }
}
