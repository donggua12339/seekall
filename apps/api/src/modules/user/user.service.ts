import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { BusinessException } from '../../common/filters/http-exception.filter'
import { ErrorCode } from '../../common/constants/error-codes'

/** tier 对应价格(元),用于交易记录 + 收据 */
const TIER_PRICE: Record<string, number> = {
  trial: 1,
  monthly: 18,
  lifetime: 68,
}

/** tier 中文标签 */
const TIER_LABEL: Record<string, string> = {
  trial: '试用(7 天)',
  monthly: '月度会员(30 天)',
  lifetime: '终身会员(100 年)',
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name)

  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    })
    if (!user) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404)
    }

    const { passwordHash: _ph, emailVerifyToken: _evt, passwordResetToken: _prt, ...safe } = user
    return safe
  }

  async updateProfile(
    userId: bigint,
    updates: {
      avatarUrl?: string
      bio?: string
    },
  ) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(updates.avatarUrl !== undefined && { avatarUrl: updates.avatarUrl }),
        ...(updates.bio !== undefined && { bio: updates.bio }),
      },
    })

    const { passwordHash: _ph, emailVerifyToken: _evt, passwordResetToken: _prt, ...safe } = updated
    return safe
  }

  async deleteAccount(userId: bigint): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        status: 'deleted' as const,
        // 匿名化
        username: `deleted_${userId}`,
        email: `deleted_${userId}@seekall.local`,
        passwordHash: 'deleted',
        emailVerifyToken: null,
        passwordResetToken: null,
      },
    })
    this.logger.log(`User account deleted: ${userId}`)
    return { message: '账号已注销,30 天后用户名将被释放' }
  }

  /**
   * 交易记录: 从 license 表聚合(usedBy = 当前用户)
   * 金额从 tier 推算(不存真实金额,避免 schema 改动)
   */
  async getTransactions(userId: bigint) {
    const licenses = await this.prisma.license.findMany({
      where: { usedBy: userId },
      orderBy: { usedAt: 'desc' },
    })

    return licenses.map((l) => {
      // 从 note 提取 wm-order:xxx
      const wmOrder = l.note?.match(/wm-order:(\S+)/)?.[1] || null
      return {
        id: l.id.toString(),
        licenseCode: l.code,
        tier: l.tier,
        tierLabel: TIER_LABEL[l.tier] || l.tier,
        amount: TIER_PRICE[l.tier] || 0,
        wmOrderId: wmOrder,
        status: l.status,
        paidAt: l.usedAt?.toISOString() || l.createdAt.toISOString(),
        createdAt: l.createdAt.toISOString(),
      }
    })
  }

  /**
   * 电子收据申请: 记录申请,返回收据信息(非税务发票,仅供报销参考)
   * 收据 ID = license code 的 hash,保证可追溯
   */
  async requestReceipt(
    userId: bigint,
    input: {
      licenseCode: string
      title: string
      email: string
    },
  ) {
    // 验证 license 属于该用户
    const license = await this.prisma.license.findFirst({
      where: { code: input.licenseCode, usedBy: userId },
    })
    if (!license) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404)
    }

    const amount = TIER_PRICE[license.tier] || 0
    const receiptId = `SA-RCPT-${license.id.toString(36).toUpperCase().padStart(8, '0')}`

    return {
      receiptId,
      licenseCode: license.code,
      tier: license.tier,
      tierLabel: TIER_LABEL[license.tier] || license.tier,
      amount,
      title: input.title,
      email: input.email,
      issuedAt: new Date().toISOString(),
      paidAt: license.usedAt?.toISOString() || license.createdAt.toISOString(),
      disclaimer: '本收据非税务发票,仅供报销参考。如需正规发票,请联系客服。',
    }
  }

  /**
   * 退款申请: 记录到 adminAuditLog,admin 后台审核
   * 规则: 7 天内 + license 未使用(unused)可退
   */
  async requestRefund(
    userId: bigint,
    input: {
      licenseCode: string
      reason: string
    },
  ) {
    const license = await this.prisma.license.findFirst({
      where: { code: input.licenseCode, usedBy: userId },
    })
    if (!license) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404)
    }

    // 7 天内限制
    const usedAt = license.usedAt || license.createdAt
    const daysSinceUsed = (Date.now() - usedAt.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSinceUsed > 7) {
      throw new BusinessException(ErrorCode.PARAM_ERROR, 400)
    }

    // 记录到 adminAuditLog,action='refund_request',等待 admin 审核
    await this.prisma.adminAuditLog.create({
      data: {
        adminId: userId, // 发起人是用户自己(admin 审核时再填 adminId)
        action: 'refund_request',
        targetType: 'license',
        targetId: license.id,
        detail: {
          licenseCode: license.code,
          tier: license.tier,
          reason: input.reason,
          userId: userId.toString(),
        },
      },
    })

    this.logger.log(`Refund requested: license=${license.code} user=${userId}`)

    return {
      message: '退款申请已提交,等待 admin 审核',
      licenseCode: license.code,
      tier: license.tier,
      reason: input.reason,
    }
  }

  /**
   * 查询我的退款申请列表
   */
  async getMyRefunds(userId: bigint) {
    const logs = await this.prisma.adminAuditLog.findMany({
      where: {
        action: 'refund_request',
        adminId: userId,
      },
      orderBy: { createdAt: 'desc' },
    })

    return logs.map((log) => ({
      id: log.id.toString(),
      licenseCode: (log.detail as { licenseCode?: string })?.licenseCode || '',
      tier: (log.detail as { tier?: string })?.tier || '',
      reason: (log.detail as { reason?: string })?.reason || '',
      status: (log.detail as { status?: string })?.status || 'pending',
      createdAt: log.createdAt.toISOString(),
    }))
  }

  /**
   * 云同步: 获取用户配置(默认规则 + 输出格式等)
   * 存在 configs 表,key = user_config:{userId}
   */
  async getSync(userId: bigint): Promise<{
    defaultRules: string[]
    outputFormat: string
    customConfig: Record<string, unknown>
    updatedAt: string
  } | null> {
    const key = `user_config:${userId}`
    const config = await this.prisma.config.findUnique({ where: { key } })
    if (!config) return null
    try {
      const parsed = JSON.parse(config.value) as {
        defaultRules?: string[]
        outputFormat?: string
        customConfig?: Record<string, unknown>
      }
      return {
        defaultRules: parsed.defaultRules || [],
        outputFormat: parsed.outputFormat || 'text',
        customConfig: parsed.customConfig || {},
        updatedAt: config.updatedAt.toISOString(),
      }
    } catch {
      return null
    }
  }

  /**
   * 云同步: 保存用户配置
   */
  async saveSync(
    userId: bigint,
    data: {
      defaultRules?: string[]
      outputFormat?: string
      customConfig?: Record<string, unknown>
    },
  ) {
    const key = `user_config:${userId}`
    const value = JSON.stringify({
      defaultRules: data.defaultRules || [],
      outputFormat: data.outputFormat || 'text',
      customConfig: data.customConfig || {},
    })

    await this.prisma.config.upsert({
      where: { key },
      update: { value },
      create: { key, value, description: `User config for ${userId}` },
    })

    this.logger.log(`User config synced: user=${userId}`)

    return {
      message: '配置已同步',
      updatedAt: new Date().toISOString(),
    }
  }
}
