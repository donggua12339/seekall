import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { randomBytes } from 'crypto'

@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * W1: Admin 手动生成 license code
   * W2: WM webhook 半自动同步（外部调用此方法）
   * W3: 老用户邀请码（trial 类型，每月限 3 个）
   */
  async generateCode(input: {
    tier: 'trial' | 'monthly' | 'lifetime'
    generatedBy: bigint
    note?: string
  }) {
    const code = this.formatCode(input.tier)
    return this.prisma.license.create({
      data: {
        code,
        tier: input.tier,
        status: 'unused',
        generatedBy: input.generatedBy,
        note: input.note,
      },
    })
  }

  /**
   * 老用户生成 ¥1 邀请码（每月限 3 个）
   */
  async generateInviteTrialCode(userId: bigint) {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const monthCount = await this.prisma.license.count({
      where: {
        generatedBy: userId,
        tier: 'trial',
        createdAt: { gte: monthStart },
      },
    })

    if (monthCount >= 3) {
      throw new ForbiddenException('本月邀请码已用完（限 3 个/月）')
    }

    return this.generateCode({
      tier: 'trial',
      generatedBy: userId,
      note: 'invite-trial',
    })
  }

  /**
   * 用户兑换 license code
   * - 检查 code 是否有效
   * - 检查 trial 防羊毛（每账号限 1 次）
   * - 更新 user.isPaid + paidUntil
   */
  async redeem(code: string, userId: bigint) {
    const license = await this.prisma.license.findUnique({ where: { code } })
    if (!license) throw new NotFoundException('License code 不存在')
    if (license.status !== 'unused') {
      throw new BadRequestException('License code 已被使用')
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new NotFoundException('用户不存在')

    // trial 防羊毛：每账号限 1 次
    if (license.tier === 'trial') {
      const claimed = await this.prisma.licenseClaim.findFirst({
        where: { userId, license: { tier: 'trial' } },
      })
      if (claimed) {
        throw new BadRequestException('试用套餐每账号限领 1 次')
      }
    }

    // 计算到期时间
    const now = new Date()
    let paidUntil: Date
    switch (license.tier) {
      case 'trial':
        paidUntil = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 天
        break
      case 'monthly':
        paidUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 天
        break
      case 'lifetime':
        paidUntil = new Date(now.getTime() + 100 * 365 * 24 * 60 * 60 * 1000) // 100 年
        break
    }

    // 事务：更新 license 状态 + 更新 user + 记录 claim
    return this.prisma.$transaction(async (tx) => {
      await tx.license.update({
        where: { id: license.id },
        data: { status: 'used', usedBy: userId, usedAt: now },
      })
      await tx.licenseClaim.create({
        data: { userId, licenseId: license.id },
      })
      return tx.user.update({
        where: { id: userId },
        data: {
          isPaid: true,
          paidUntil,
          tier: license.tier,
        },
      })
    })
  }

  /**
   * W2: WM webhook 回调入口
   * WM 付款成功 -> POST SeekAll -> 生成 code 入库
   */
  async handleWmWebhook(input: {
    wmOrderId: string
    tier: 'trial' | 'monthly' | 'lifetime'
    amount: number
    signature: string
  }) {
    // TODO: 验证 WM webhook 签名（D17 实现）
    this.logger.log(`WM webhook received: order=${input.wmOrderId} tier=${input.tier}`)

    return this.prisma.license.create({
      data: {
        code: this.formatCode(input.tier),
        tier: input.tier,
        status: 'unused',
        note: `wm-order:${input.wmOrderId}`,
      },
    })
  }

  private formatCode(tier: 'trial' | 'monthly' | 'lifetime'): string {
    const prefix = tier === 'trial' ? 'SA-TRY-' : tier === 'monthly' ? 'SA-MON-' : 'SA-LIF-'
    const random = randomBytes(8).toString('hex').toUpperCase()
    return prefix + random
  }
}
