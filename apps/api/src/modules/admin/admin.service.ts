import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const [
      userCount,
      paidUserCount,
      activeUserCount,
      searchCountToday,
      inviteCodeUnused,
      membershipCodeUnused,
      takedownPending,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { isPaid: true, deletedAt: null } }),
      this.prisma.user.count({ where: { status: 'active', deletedAt: null } }),
      this.prisma.searchLog.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.inviteCode.count({ where: { status: 'unused' } }),
      this.prisma.membershipCode.count({ where: { status: 'unused' } }),
      this.prisma.takedownRecord.count({ where: { status: 'pending' } }),
    ])

    return {
      users: {
        total: userCount,
        paid: paidUserCount,
        active: activeUserCount,
      },
      searches: {
        today: searchCountToday,
      },
      codes: {
        inviteUnused: inviteCodeUnused,
        membershipUnused: membershipCodeUnused,
      },
      takedown: {
        pending: takedownPending,
      },
    }
  }

  async listUsers(page: number, pageSize: number, search?: string) {
    const where = search
      ? {
          OR: [
            { username: { contains: search } },
            { email: { contains: search } },
          ],
          deletedAt: null,
        }
      : { deletedAt: null }

    const [list, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isPaid: true,
          paidUntil: true,
          status: true,
          badge: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ])
    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  async banUser(id: bigint, reason: string, adminId: bigint) {
    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action: 'ban_user',
        targetType: 'user',
        targetId: id,
        detail: { reason },
      },
    })
    return this.prisma.user.update({
      where: { id },
      data: { status: 'banned' as const, bannedReason: reason },
    })
  }

  async unbanUser(id: bigint, adminId: bigint) {
    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action: 'unban_user',
        targetType: 'user',
        targetId: id,
      },
    })
    return this.prisma.user.update({
      where: { id },
      data: { status: 'active' as const, bannedReason: null },
    })
  }

  async auditLogs(page: number, pageSize: number) {
    const [list, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { admin: { select: { username: true } } },
      }),
      this.prisma.adminAuditLog.count(),
    ])
    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  /**
   * 用户行为分析面板
   * - 最近 7/30 天搜索趋势
   * - 热门关键词 top N
   * - 活跃用户（DAU/WAU/MAU）
   * - 资源类型分布
   */
  async analytics(days: number = 7) {
    const now = Date.now()
    const since = new Date(now - days * 24 * 60 * 60 * 1000)
    const since30 = new Date(now - 30 * 24 * 60 * 60 * 1000)
    const since7 = new Date(now - 7 * 24 * 60 * 60 * 1000)
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [searchTrend, topKeywords, dau, wau, mau, totalSearches, totalUsers] =
      await Promise.all([
        // 每日搜索趋势
        this.prisma.searchLog.groupBy({
          by: ['createdAt'],
          where: { createdAt: { gte: since } },
          _count: { _all: true },
          orderBy: { createdAt: 'asc' },
        }).catch(() => []),
        // 热门关键词 top 20
        this.prisma.searchLog.groupBy({
          by: ['query'],
          where: { createdAt: { gte: since }, query: { not: '' } },
          _count: { query: true },
          orderBy: { _count: { query: 'desc' } },
          take: 20,
        }).catch(() => []),
        // DAU
        this.prisma.user.count({
          where: { lastLoginAt: { gte: todayStart }, deletedAt: null },
        }).catch(() => 0),
        // WAU
        this.prisma.user.count({
          where: { lastLoginAt: { gte: since7 }, deletedAt: null },
        }).catch(() => 0),
        // MAU
        this.prisma.user.count({
          where: { lastLoginAt: { gte: since30 }, deletedAt: null },
        }).catch(() => 0),
        // 总搜索次数
        this.prisma.searchLog.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
        // 总用户数
        this.prisma.user.count({ where: { deletedAt: null } }).catch(() => 0),
      ])

    // 按天聚合趋势
    const trendByDay: Record<string, number> = {}
    for (const item of searchTrend as Array<{ createdAt: Date; _count: { _all: number } }>) {
      const day = item.createdAt.toISOString().slice(0, 10)
      trendByDay[day] = (trendByDay[day] || 0) + item._count._all
    }

    return {
      summary: {
        totalSearches,
        totalUsers,
        dau,
        wau,
        mau,
        avgSearchesPerUser: totalUsers > 0 ? Math.round(totalSearches / totalUsers) : 0,
      },
      trend: Object.entries(trendByDay).map(([date, count]) => ({ date, count })),
      topKeywords: (topKeywords as Array<{ query: string; _count: { query: number } }>).map(
        (item) => ({ keyword: item.query, count: item._count.query }),
      ),
    }
  }
}
