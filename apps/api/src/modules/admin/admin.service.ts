import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { BusinessException } from '../../common/filters/http-exception.filter'
import { ErrorCode } from '../../common/constants/error-codes'

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name)

  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const [userCount, paidUserCount, activeUserCount, licenseCount] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }).catch(() => 0),
      this.prisma.user.count({ where: { isPaid: true, deletedAt: null } }).catch(() => 0),
      this.prisma.user.count({ where: { status: 'active', deletedAt: null } }).catch(() => 0),
      this.prisma.license.count().catch(() => 0),
    ])

    return {
      users: {
        total: userCount,
        paid: paidUserCount,
        active: activeUserCount,
      },
      licenses: {
        total: licenseCount,
      },
    }
  }

  async listUsers(page: number, pageSize: number, search?: string) {
    const where = search
      ? {
          OR: [{ username: { contains: search } }, { email: { contains: search } }],
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

  /**
   * 设置用户徽章（贡献者激励：none/contributor/reviewer/early_adopter）
   * 徽章字段在 User 模型已存在（badge String? @db.VarChar(64)）
   */
  async setUserBadge(id: bigint, badge: string, adminId: bigint) {
    const allowed = ['none', 'contributor', 'reviewer', 'early_adopter']
    if (!allowed.includes(badge)) {
      throw new Error(`invalid badge: ${badge}`)
    }
    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action: 'set_user_badge',
        targetType: 'user',
        targetId: id,
        detail: { badge },
      },
    })
    return this.prisma.user.update({
      where: { id },
      data: { badge: badge === 'none' ? null : badge },
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
   * 退款审核: 列出所有退款申请(action='refund_request')
   */
  async listRefunds(page: number, pageSize: number, status?: string) {
    const where = {
      action: 'refund_request' as const,
      ...(status && status !== 'all' ? { detail: { path: ['status'], equals: status } } : {}),
    }
    const [list, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { admin: { select: { id: true, username: true } } },
      }),
      this.prisma.adminAuditLog.count({ where }),
    ])
    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  /**
   * 退款审核: approve / reject
   * 更新 audit log detail.status,记录审核 admin
   */
  async reviewRefund(logId: bigint, action: 'approve' | 'reject', adminId: bigint, note?: string) {
    const log = await this.prisma.adminAuditLog.findUnique({ where: { id: logId } })
    if (!log || log.action !== 'refund_request') {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404)
    }

    const detail = (log.detail as Record<string, unknown>) || {}
    const newDetail = {
      ...detail,
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewedBy: adminId.toString(),
      reviewedAt: new Date().toISOString(),
      adminNote: note || null,
    }

    const updated = await this.prisma.adminAuditLog.update({
      where: { id: logId },
      data: { detail: newDetail },
    })

    // 如果 approve,把 license status 改为 disabled(标记已退款)
    if (action === 'approve') {
      const licenseCode = (detail as { licenseCode?: string })?.licenseCode
      if (licenseCode) {
        await this.prisma.license.updateMany({
          where: { code: licenseCode },
          data: { status: 'disabled' },
        })
      }
    }

    // 记录审核操作到 audit log
    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action: action === 'approve' ? 'refund_approved' : 'refund_rejected',
        targetType: 'license',
        targetId: log.targetId,
        detail: {
          refundRequestLogId: logId.toString(),
          licenseCode: (detail as { licenseCode?: string })?.licenseCode,
          note: note || null,
        },
      },
    })

    this.logger.log(`Refund ${action}d: log=${logId} admin=${adminId}`)
    return updated
  }

  /**
   * v0.5 极简版：用户行为分析暂未实现
   * v0.4 的 searchLog / favorite / collection 表已砍掉
   * 后续 D11+ 重新基于 license / rule 订阅数据实现
   */
  async analytics(_days: number = 7) {
    const since = new Date(Date.now() - _days * 24 * 60 * 60 * 1000)

    const [newUsers, newLicenses, newRules, reviews, takedowns] = await Promise.all([
      this.prisma.user.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
      this.prisma.license.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
      this.prisma.rule.count({ where: { createdAt: { gte: since } } }).catch(() => 0),
      this.prisma.adminAuditLog
        .count({ where: { action: 'rule_review', createdAt: { gte: since } } })
        .catch(() => 0),
      this.prisma.adminAuditLog
        .count({ where: { action: 'rule_takedown', createdAt: { gte: since } } })
        .catch(() => 0),
    ])

    return {
      days: _days,
      since: since.toISOString(),
      metrics: {
        newUsers,
        newLicenses,
        newRules,
        reviews,
        takedowns,
      },
    }
  }

  /**
   * S4 失效标注：用户举报规则失效
   * 累计 ≥3 次举报 -> 自动隐藏（status=taken_down）待 admin 复核
   * 复用 AdminAuditLog 表，action='rule_report_dead'
   */
  async reportDeadRule(input: { ruleId: bigint; userId: bigint; note?: string }) {
    const rule = await this.prisma.rule.findUnique({ where: { id: input.ruleId } })
    if (!rule) throw new NotFoundException('Rule not found')

    await this.prisma.adminAuditLog.create({
      data: {
        adminId: input.userId,
        action: 'rule_report_dead',
        targetType: 'rule',
        targetId: input.ruleId,
        detail: { note: input.note },
      },
    })

    const reports = await this.prisma.adminAuditLog.count({
      where: {
        action: 'rule_report_dead',
        targetId: input.ruleId,
      },
    })

    // S4 自动隐藏阈值：≥3 次举报
    const threshold = 3
    if (reports >= threshold && rule.status === 'published') {
      await this.prisma.rule.update({
        where: { id: input.ruleId },
        data: { status: 'taken_down' },
      })
      return {
        ruleId: input.ruleId,
        reports,
        autoHidden: true,
        message: `规则因 ${reports} 次失效举报自动隐藏，待 admin 复核`,
      }
    }

    return {
      ruleId: input.ruleId,
      reports,
      autoHidden: false,
      message: `举报已记录（${reports}/${threshold}）`,
    }
  }

  /**
   * 透明度报告：上月 takedown 统计
   * - 收到举报数
   * - 处理数
   * - 平均响应时间（TODO：需要记录收到时间，当前简化）
   * - 拒绝数（误报）
   */
  async transparencyReport() {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)
    const lastMonthStart = new Date(monthStart)
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1)
    const monthEnd = new Date(monthStart)

    const [takedowns, reviews, reports] = await Promise.all([
      this.prisma.adminAuditLog.count({
        where: {
          action: 'rule_takedown',
          createdAt: { gte: lastMonthStart, lt: monthEnd },
        },
      }),
      this.prisma.adminAuditLog.count({
        where: {
          action: 'rule_review',
          createdAt: { gte: lastMonthStart, lt: monthEnd },
        },
      }),
      this.prisma.adminAuditLog.count({
        where: {
          action: 'rule_report_dead',
          createdAt: { gte: lastMonthStart, lt: monthEnd },
        },
      }),
    ])

    return {
      period: {
        start: lastMonthStart.toISOString(),
        end: monthEnd.toISOString(),
      },
      stats: {
        takedowns,
        reviews,
        deadReports: reports,
      },
      note: '透明度报告每月 1 号自动发布到 GitHub',
    }
  }

  // ============ 邮箱验证模式设置 ============

  async getEmailVerifyMode(): Promise<{ mode: string }> {
    const config = await this.prisma.config.findUnique({
      where: { key: 'email_verify_mode' },
    })
    return { mode: config?.value === 'link' ? 'link' : 'code' }
  }

  async setEmailVerifyMode(mode: 'code' | 'link', adminId: bigint): Promise<{ mode: string }> {
    if (mode !== 'code' && mode !== 'link') {
      throw new Error('mode must be "code" or "link"')
    }
    await this.prisma.config.upsert({
      where: { key: 'email_verify_mode' },
      create: { key: 'email_verify_mode', value: mode },
      update: { value: mode },
    })
    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action: 'set_email_verify_mode',
        targetType: 'config',
        targetId: null,
        detail: { mode },
      },
    })
    return { mode }
  }
}
