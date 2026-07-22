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
   * 校验用户会员档位是否满足订阅/评审 L2 规则的要求
   *
   * 规则(见 CLAUDE.md 会员档位表):
   *   - trial(¥1): 只能 L0-L1
   *   - monthly(¥18) / lifetime(¥68): 可 L0-L2
   *   - free / 过期: 不能 L2
   *
   * @param minTier 最低要求的 tier('monthly' | 'lifetime')
   * @throws ForbiddenException 如果不满足
   */
  private async validateUserTier(userId: bigint, minTier: 'monthly' | 'lifetime'): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { isPaid: true, tier: true, paidUntil: true, status: true },
    })
    if (!user || user.status === 'banned' || user.status === 'deleted') {
      throw new ForbiddenException('账号不可用')
    }

    // isPaid 为 false 直接拒
    if (!user.isPaid) {
      throw new ForbiddenException(
        minTier === 'monthly' ? '该操作需付费会员(月度 ¥18 起)' : '该操作需终身会员',
      )
    }

    // 校验 paidUntil 未过期(isPaid 可能是缓存值,paidUntil 才是真实到期)
    if (user.paidUntil && user.paidUntil < new Date()) {
      throw new ForbiddenException('会员已过期,请续费')
    }

    // 校验 tier 等级
    const TIER_RANK: Record<string, number> = { trial: 1, monthly: 2, lifetime: 3 }
    const userRank = user.tier ? TIER_RANK[user.tier] || 0 : 0
    const requiredRank = TIER_RANK[minTier]
    if (userRank < requiredRank) {
      throw new ForbiddenException(
        `该操作需 ${minTier === 'monthly' ? '月度(¥18)' : '终身(¥68)'} 会员,当前档位: ${user.tier || 'free'}`,
      )
    }
  }

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

    // 评审员需 monthly 及以上会员(trial 不能评审,见 CLAUDE.md)
    await this.validateUserTier(input.reviewerId, 'monthly')

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
   * 列出某规则的所有评审(admin 查看评审详情)
   */
  async listReviews(ruleId: bigint) {
    const rule = await this.prisma.rule.findUnique({ where: { id: ruleId } })
    if (!rule) throw new NotFoundException('Rule not found')

    const [reviews, approvals, rejections] = await Promise.all([
      this.prisma.ruleReview.findMany({
        where: { ruleId },
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: {
            select: { id: true, username: true },
          },
        },
      }),
      this.prisma.ruleReview.count({ where: { ruleId, approve: true } }),
      this.prisma.ruleReview.count({ where: { ruleId, approve: false } }),
    ])

    return {
      ruleId: ruleId.toString(),
      npmPackage: rule.npmPackage,
      riskLevel: rule.riskLevel,
      status: rule.status,
      summary: {
        total: approvals + rejections,
        approvals,
        rejections,
        threshold: 3,
        readyForFinalReview: approvals >= 3,
      },
      reviews: reviews.map((r) => ({
        id: r.id.toString(),
        reviewerId: r.reviewerId.toString(),
        reviewerUsername: r.reviewer.username,
        approve: r.approve,
        comment: r.comment,
        createdAt: r.createdAt.toISOString(),
      })),
    }
  }

  /**
   * Takedown 规则(收到 DMCA 后 admin 操作)
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
      throw new BadRequestException('规则未发布,无法订阅')
    }

    // L3/L4 永远不可订阅
    if (rule.riskLevel === RuleRiskLevel.l3 || rule.riskLevel === RuleRiskLevel.l4) {
      throw new ForbiddenException('L3/L4 规则不可订阅')
    }

    // L2 需 monthly 及以上会员(trial 不行,见 CLAUDE.md 会员档位表)
    if (rule.riskLevel === RuleRiskLevel.l2) {
      await this.validateUserTier(userId, 'monthly')
    }

    // upsert 幂等:已订阅则不动,未订阅则创建
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

  /**
   * 当前用户提交的规则列表（含所有状态：pending_review / published / taken_down / banned）
   * 用于"我的规则"页面，让贡献者能跟踪自己规则的审核进度 + npm 下载量
   */
  async mySubmitted(userId: bigint) {
    return this.prisma.rule.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * 贡献者排行榜（公开，按 published 规则数排序）
   * 用于 docs-site/contributors 页面激励社区贡献
   * 只统计 published 状态的规则，takedown/banned 不算
   */
  async contributors() {
    // Prisma groupBy 的 _count 类型为 `true | {...}`,用 raw SQL 避免 cast
    const rows = await this.prisma.$queryRaw<Array<{ authorId: bigint; cnt: bigint }>>`
      SELECT author_id AS authorId, COUNT(*) as cnt
      FROM \`rules\`
      WHERE status = 'published' AND author_id IS NOT NULL
      GROUP BY author_id
      ORDER BY cnt DESC
      LIMIT 50
    `

    if (rows.length === 0) return []

    const authorIds = rows.map((r) => r.authorId)

    const users = await this.prisma.user.findMany({
      where: { id: { in: authorIds } },
      select: {
        id: true,
        username: true,
        badge: true,
        bio: true,
        createdAt: true,
      },
    })

    const userMap = new Map(users.map((u) => [u.id, u]))

    return rows
      .map((r) => {
        const user = userMap.get(r.authorId)
        if (!user) return null
        return {
          id: user.id.toString(),
          username: user.username,
          badge: user.badge,
          bio: user.bio,
          joinedAt: user.createdAt.toISOString(),
          publishedCount: Number(r.cnt),
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
  }
}
