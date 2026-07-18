import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common'
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

// 数字 0..n 对应的所有 enum 值列表（Prisma enum 不支持 lte，需用 in）
function riskLevelsUpTo(max: number): RuleRiskLevel[] {
  return Array.from({ length: max + 1 }, (_, i) => RISK_LEVEL_MAP[i])
}

@Injectable()
export class RuleService {
  private readonly logger = new Logger(RuleService.name)

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

    // Prisma enum 不支持 lte 比较，用 in 列表
    let riskLevelFilter: RuleRiskLevel | RuleRiskLevel[]
    if (options.riskLevel !== undefined) {
      // 显式按 riskLevel 过滤时，先检查权限
      if (options.riskLevel > maxRiskNum) {
        return { list: [], total: 0, page, pageSize, totalPages: 0 }
      }
      riskLevelFilter = RISK_LEVEL_MAP[options.riskLevel]
    } else {
      riskLevelFilter = riskLevelsUpTo(maxRiskNum)
    }

    const where: Record<string, unknown> = {
      status: RuleStatus.published,
      riskLevel: Array.isArray(riskLevelFilter) ? { in: riskLevelFilter } : riskLevelFilter,
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
      throw new BadRequestException('adminCreate 仅用于 L3/L4 规则')
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

  /**
   * E 社群评审工作流（L2 规则）
   * - 评审员需 ¥18 月卡及以上（isPaid === true）
   * - 不能评审自己提交的规则
   * - 一人一票（再次评审会更新 approve/comment）
   * - ≥3 个赞同 -> admin 终审
   */
  async review(input: { ruleId: bigint; reviewerId: bigint; approve: boolean; comment?: string }) {
    const rule = await this.prisma.rule.findUnique({ where: { id: input.ruleId } })
    if (!rule) throw new NotFoundException('Rule not found')
    if (rule.status !== RuleStatus.pending_review) {
      throw new BadRequestException('该规则不在评审中')
    }
    if (rule.authorId === input.reviewerId) {
      throw new ForbiddenException('不能评审自己提交的规则')
    }

    // 评审员需付费会员
    const reviewer = await this.prisma.user.findUnique({
      where: { id: input.reviewerId },
      select: { isPaid: true },
    })
    if (!reviewer?.isPaid) {
      throw new ForbiddenException('评审需 ¥18 月卡及以上会员')
    }

    // upsert 评审（一人一票，再次评审更新 approve/comment）
    await this.prisma.ruleReview.upsert({
      where: {
        ruleId_reviewerId: { ruleId: input.ruleId, reviewerId: input.reviewerId },
      },
      create: {
        ruleId: input.ruleId,
        reviewerId: input.reviewerId,
        approve: input.approve,
        comment: input.comment,
      },
      update: {
        approve: input.approve,
        comment: input.comment,
      },
    })

    // 统计赞同数
    const approvals = await this.prisma.ruleReview.count({
      where: { ruleId: input.ruleId, approve: true },
    })

    this.logger.log(
      `Rule ${input.ruleId} reviewed by ${input.reviewerId}: ${input.approve ? 'approve' : 'reject'} (${approvals}/3)`,
    )

    return {
      ruleId: input.ruleId,
      approve: input.approve,
      approvals,
      threshold: 3,
      readyForFinalReview: approvals >= 3,
    }
  }

  /**
   * Admin 终审（L2 评审通过后 admin 拍板）
   */
  async finalReview(input: { ruleId: bigint; adminId: bigint; approve: boolean; note?: string }) {
    const rule = await this.prisma.rule.findUnique({ where: { id: input.ruleId } })
    if (!rule) throw new NotFoundException('Rule not found')
    if (rule.status !== RuleStatus.pending_review) {
      throw new BadRequestException('该规则不在评审中')
    }

    const updated = await this.prisma.rule.update({
      where: { id: input.ruleId },
      data: {
        status: input.approve ? RuleStatus.published : RuleStatus.banned,
      },
    })

    await this.prisma.adminAuditLog.create({
      data: {
        adminId: input.adminId,
        action: 'rule_final_review',
        targetType: 'rule',
        targetId: input.ruleId,
        detail: { approve: input.approve, note: input.note },
      },
    })

    return updated
  }

  /**
   * Takedown 规则（收到 DMCA 后 admin 操作）
   * 累计 3 次 takedown -> 作者永久封禁，所有规则下架
   */
  async takedown(input: { ruleId: bigint; adminId: bigint; reason: string }) {
    const rule = await this.prisma.rule.findUnique({ where: { id: input.ruleId } })
    if (!rule) throw new NotFoundException('Rule not found')

    const updated = await this.prisma.rule.update({
      where: { id: input.ruleId },
      data: {
        status: RuleStatus.taken_down,
        takedownCount: { increment: 1 },
      },
    })

    await this.prisma.adminAuditLog.create({
      data: {
        adminId: input.adminId,
        action: 'rule_takedown',
        targetType: 'rule',
        targetId: input.ruleId,
        detail: { reason: input.reason },
      },
    })

    // 累计 3 次 -> 封禁作者 + 下架所有规则
    const authorTakedownCount = await this.prisma.rule.count({
      where: {
        authorId: rule.authorId,
        status: RuleStatus.taken_down,
      },
    })
    if (authorTakedownCount >= 3) {
      await this.prisma.user.update({
        where: { id: rule.authorId },
        data: { status: 'banned', bannedReason: '累计 3 次规则 takedown' },
      })
      await this.prisma.rule.updateMany({
        where: { authorId: rule.authorId, status: RuleStatus.published },
        data: { status: RuleStatus.taken_down },
      })
      this.logger.warn(`Author ${rule.authorId} permanently banned (3 takedowns)`)
    }

    return updated
  }

  /**
   * 用户订阅规则（同步到 SDK 配置）
   * 免费：可订阅 L0-L1
   * 付费：可订阅 L0-L2（L3/L4 永远不可订阅）
   * 幂等：重复订阅不会产生新记录
   */
  async subscribe(ruleId: bigint, userId: bigint) {
    const rule = await this.prisma.rule.findUnique({ where: { id: ruleId } })
    if (!rule) throw new NotFoundException('Rule not found')
    if (rule.status !== RuleStatus.published) {
      throw new BadRequestException('规则未发布，无法订阅')
    }

    // L3/L4 永远不可订阅
    if (rule.riskLevel === RuleRiskLevel.l3 || rule.riskLevel === RuleRiskLevel.l4) {
      throw new ForbiddenException('L3/L4 规则不可订阅')
    }

    // L2 需付费
    if (rule.riskLevel === RuleRiskLevel.l2) {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { isPaid: true },
      })
      if (!user?.isPaid) {
        throw new ForbiddenException('L2 规则需付费会员')
      }
    }

    // upsert 幂等：已订阅则不动，未订阅则创建
    await this.prisma.ruleSubscription.upsert({
      where: {
        userId_ruleId: { userId, ruleId },
      },
      create: { userId, ruleId },
      update: {},
    })

    return { ruleId, npmPackage: rule.npmPackage, subscribed: true }
  }

  /**
   * 用户取消订阅规则
   */
  async unsubscribe(ruleId: bigint, userId: bigint) {
    const sub = await this.prisma.ruleSubscription.findUnique({
      where: { userId_ruleId: { userId, ruleId } },
    })
    if (!sub) {
      throw new NotFoundException('未订阅该规则')
    }
    await this.prisma.ruleSubscription.delete({
      where: { userId_ruleId: { userId, ruleId } },
    })
    return { ruleId, subscribed: false }
  }

  /**
   * 用户已订阅规则列表（SDK 拉取）
   */
  async mySubscriptions(userId: bigint) {
    const subs = await this.prisma.ruleSubscription.findMany({
      where: { userId },
      select: { ruleId: true },
    })
    if (subs.length === 0) return []

    return this.prisma.rule.findMany({
      where: {
        id: { in: subs.map((s) => s.ruleId) },
        status: RuleStatus.published,
      },
      select: {
        id: true,
        npmPackage: true,
        riskLevel: true,
        description: true,
        version: true,
      },
    })
  }
}
