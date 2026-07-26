import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { ConfigService } from '@nestjs/config'
import { createHmac, timingSafeEqual } from 'crypto'
import { randomBytes } from 'crypto'

@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

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
   * License 列表（admin 用）
   */
  async list(options: {
    page: number
    pageSize: number
    status?: 'unused' | 'used' | 'disabled'
    tier?: 'trial' | 'monthly' | 'lifetime'
  }) {
    const where: Record<string, unknown> = {}
    if (options.status) where.status = options.status
    if (options.tier) where.tier = options.tier

    const [list, total] = await Promise.all([
      this.prisma.license.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
      }),
      this.prisma.license.count({ where }),
    ])
    return {
      list,
      total,
      page: options.page,
      pageSize: options.pageSize,
      totalPages: Math.ceil(total / options.pageSize),
    }
  }

  async get(id: bigint) {
    const license = await this.prisma.license.findUnique({ where: { id } })
    if (!license) throw new NotFoundException('License 不存在')
    return license
  }

  async disable(id: bigint) {
    const license = await this.prisma.license.findUnique({ where: { id } })
    if (!license) throw new NotFoundException('License 不存在')
    if (license.status === 'used') {
      throw new BadRequestException('已使用的 license 不能禁用')
    }
    return this.prisma.license.update({
      where: { id },
      data: { status: 'disabled' },
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
   * 查询用户本月邀请码用量 + 已生成列表
   */
  async myInviteTrialCodes(userId: bigint) {
    const monthStart = new Date()
    monthStart.setDate(1)
    monthStart.setHours(0, 0, 0, 0)

    const [monthCount, list] = await Promise.all([
      this.prisma.license.count({
        where: {
          generatedBy: userId,
          tier: 'trial',
          createdAt: { gte: monthStart },
        },
      }),
      this.prisma.license.findMany({
        where: {
          generatedBy: userId,
          tier: 'trial',
          note: 'invite-trial',
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          code: true,
          status: true,
          createdAt: true,
          usedAt: true,
        },
      }),
    ])

    return {
      monthlyLimit: 3,
      monthlyUsed: monthCount,
      monthlyRemaining: 3 - monthCount,
      monthStart: monthStart.toISOString(),
      list,
    }
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
   * WM 付款成功 -> POST SeekAll -> 验证签名 -> 生成 code 入库
   *
   * 签名算法（WM 约定）：
   *   HMAC-SHA256(WM_WEBHOOK_SECRET, "${wmOrderId}|${tier}|${amount}")
   *   前端 header: X-WM-Signature: <hex>
   */
  async handleWmWebhook(input: {
    wmOrderId: string
    tier: 'trial' | 'monthly' | 'lifetime'
    amount: number
    signature: string
    cardContent?: string
  }) {
    // 验证签名
    const secret = this.configService.get<string>('WM_WEBHOOK_SECRET')
    if (!secret) {
      this.logger.error('WM_WEBHOOK_SECRET not configured')
      throw new UnauthorizedException('Webhook secret not configured')
    }

    const expectedSig = createHmac('sha256', secret)
      .update(`${input.wmOrderId}|${input.tier}|${input.amount}`)
      .digest('hex')

    if (!this.safeEqual(expectedSig, input.signature)) {
      this.logger.warn(`WM webhook signature mismatch: order=${input.wmOrderId}`)
      throw new UnauthorizedException('签名验证失败')
    }

    // 幂等检查：同 wmOrderId 已处理过则直接返回已存在的 license
    const existing = await this.prisma.license.findFirst({
      where: { note: { contains: `wm-order:${input.wmOrderId}` } },
    })
    if (existing) {
      this.logger.log(`WM webhook duplicate: order=${input.wmOrderId}, return existing license`)
      return existing
    }

    this.logger.log(
      `WM webhook verified: order=${input.wmOrderId} tier=${input.tier} amount=${input.amount}`,
    )

    // 如果 WM 传了 cardContent（发给用户的卡密内容），直接用它作为 license code
    // 这样用户拿到 WM 卡密后可以直接 redeem，无需格式转换
    // 如果没传（旧版 WM webhook），自己生成 SA-XXX-XXXX 格式（兼容）
    const licenseCode = input.cardContent || this.formatCode(input.tier)

    return this.prisma.license.create({
      data: {
        code: licenseCode,
        tier: input.tier,
        status: 'unused',
        note: `wm-order:${input.wmOrderId}`,
      },
    })
  }

  /**
   * 时序安全比较，防 side-channel attack
   */
  private safeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    try {
      return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
    } catch {
      return false
    }
  }

  private formatCode(tier: 'trial' | 'monthly' | 'lifetime'): string {
    const prefix = tier === 'trial' ? 'SA-TRY-' : tier === 'monthly' ? 'SA-MON-' : 'SA-LIF-'
    const random = randomBytes(8).toString('hex').toUpperCase()
    return prefix + random
  }
}
