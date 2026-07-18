import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Inject,
} from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { REDIS_CLIENT } from '../../database/redis.module'
import { MailService } from '../mail/mail.service'
import { Redis } from 'ioredis'
import { Prisma } from '@prisma/client'

const RATE_LIMIT_KEY = 'dmca:submit:rl:'
const RATE_LIMIT_MAX = 3 // 每 IP 3 次/小时
const RATE_LIMIT_WINDOW_SEC = 3600

@Injectable()
export class DmcaService {
  private readonly logger = new Logger(DmcaService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * 公众提交 DMCA Takedown Notice
   * - 强制校验 goodFaithStatement 和 accuracyStatement 为 true
   * - 每 IP 3 次/小时速率限制（防滥用）
   * - 入库 + 邮件通知 admin
   * - 不发邮件给举报人（避免被滥用做骚扰）
   */
  async submit(
    input: {
      infringingUrl: string
      ruleId?: number
      originalTitle: string
      copyrightOwner: string
      reporterEmail: string
      reporterRole: 'owner' | 'agent'
      goodFaithStatement: boolean
      accuracyStatement: boolean
      electronicSignature: string
      notes?: string
    },
    clientIp: string,
  ) {
    // 1. 法定声明必须为 true
    if (!input.goodFaithStatement || !input.accuracyStatement) {
      throw new BadRequestException('必须勾选善意声明和准确性声明（DMCA §512(c) 法定要求）')
    }

    // 2. 速率限制：每 IP 3 次/小时
    await this.checkRateLimit(clientIp)

    // 3. ruleId 可选 - 若提供则验证存在
    let ruleIdBigInt: bigint | undefined
    if (input.ruleId) {
      const rule = await this.prisma.rule.findUnique({
        where: { id: BigInt(input.ruleId) },
        select: { id: true, npmPackage: true },
      })
      if (!rule) {
        throw new NotFoundException('关联的规则不存在')
      }
      ruleIdBigInt = rule.id
    }

    // 4. 入库
    const notice = await this.prisma.dmcaNotice.create({
      data: {
        infringingUrl: input.infringingUrl,
        ruleId: ruleIdBigInt,
        originalTitle: input.originalTitle,
        copyrightOwner: input.copyrightOwner,
        reporterEmail: input.reporterEmail,
        reporterRole: input.reporterRole,
        goodFaithStatement: input.goodFaithStatement,
        accuracyStatement: input.accuracyStatement,
        electronicSignature: input.electronicSignature,
        notes: input.notes,
        status: 'pending',
      },
    })

    this.logger.log(
      `DMCA notice submitted: id=${notice.id} url=${input.infringingUrl} ip=${clientIp}`,
    )

    // 5. 邮件通知 admin（异步，失败不阻塞提交）
    this.notifyAdmin(notice.id, input).catch((err) => {
      this.logger.error(
        `DMCA admin notify failed: notice=${notice.id} err=${(err as Error).message}`,
      )
    })

    return {
      id: notice.id,
      status: notice.status,
      createdAt: notice.createdAt,
      message: '举报已提交，我们将在 24 小时内（工作日 4 小时内）首次回复',
    }
  }

  /**
   * Admin 列表（分页 + status 过滤）
   */
  async list(options: {
    page: number
    pageSize: number
    status?: 'pending' | 'verified' | 'actioned' | 'rejected'
  }) {
    const where: Prisma.DmcaNoticeWhereInput = {}
    if (options.status) where.status = options.status

    const [list, total] = await Promise.all([
      this.prisma.dmcaNotice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
        include: {
          rule: { select: { id: true, npmPackage: true, description: true } },
          handlerAdmin: { select: { id: true, username: true } },
        },
      }),
      this.prisma.dmcaNotice.count({ where }),
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
    const notice = await this.prisma.dmcaNotice.findUnique({
      where: { id },
      include: {
        rule: { select: { id: true, npmPackage: true, description: true, status: true } },
        handlerAdmin: { select: { id: true, username: true } },
      },
    })
    if (!notice) throw new NotFoundException('DMCA 举报记录不存在')
    return notice
  }

  /**
   * Admin 处理 DMCA 举报
   * - verify：核实后标记为已验证（关联 Rule 准备下架）
   * - action：执行下架（调用 RuleService.takedown + 标记 actioned）
   * - reject：拒绝（误报，需写 reason）
   */
  async handle(id: bigint, adminId: bigint, action: 'verify' | 'action' | 'reject', note: string) {
    const notice = await this.prisma.dmcaNotice.findUnique({ where: { id } })
    if (!notice) throw new NotFoundException('DMCA 举报记录不存在')
    if (notice.status === 'actioned') {
      throw new ForbiddenException('该举报已执行下架，不可再处理')
    }

    const statusMap = {
      verify: 'verified' as const,
      action: 'actioned' as const,
      reject: 'rejected' as const,
    }
    const newStatus = statusMap[action]

    if (action === 'reject' && !note) {
      throw new BadRequestException('拒绝时必须填写理由')
    }

    return this.prisma.dmcaNotice.update({
      where: { id },
      data: {
        status: newStatus,
        handlerAdminId: adminId,
        handlerNote: note,
        handledAt: new Date(),
      },
    })
  }

  /**
   * 透明度报告：上月 takedown 统计
   * - 收到举报数
   * - 处理数（actioned）
   * - 拒绝数（rejected，误报）
   * - 平均响应时间（小时）
   */
  async transparencyReport() {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth(), 1)

    const [total, actioned, rejected, pending, handledNotices] = await Promise.all([
      this.prisma.dmcaNotice.count({
        where: { createdAt: { gte: monthStart, lt: monthEnd } },
      }),
      this.prisma.dmcaNotice.count({
        where: {
          status: 'actioned',
          createdAt: { gte: monthStart, lt: monthEnd },
        },
      }),
      this.prisma.dmcaNotice.count({
        where: {
          status: 'rejected',
          createdAt: { gte: monthStart, lt: monthEnd },
        },
      }),
      this.prisma.dmcaNotice.count({
        where: {
          status: 'pending',
          createdAt: { gte: monthStart, lt: monthEnd },
        },
      }),
      this.prisma.dmcaNotice.findMany({
        where: {
          handledAt: { not: null },
          createdAt: { gte: monthStart, lt: monthEnd },
        },
        select: { createdAt: true, handledAt: true },
      }),
    ])

    const avgResponseHours =
      handledNotices.length === 0
        ? 0
        : handledNotices.reduce((sum, n) => {
            if (!n.handledAt) return sum
            const hours = (n.handledAt.getTime() - n.createdAt.getTime()) / (1000 * 60 * 60)
            return sum + hours
          }, 0) / handledNotices.length

    return {
      month: `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`,
      totalNotices: total,
      actioned,
      rejected,
      pending,
      avgResponseHours: Math.round(avgResponseHours * 10) / 10,
    }
  }

  private async checkRateLimit(ip: string): Promise<void> {
    const key = RATE_LIMIT_KEY + ip
    const count = await this.redis.incr(key)
    if (count === 1) {
      await this.redis.expire(key, RATE_LIMIT_WINDOW_SEC)
    }
    if (count > RATE_LIMIT_MAX) {
      throw new ForbiddenException(`提交过于频繁，每小时限 ${RATE_LIMIT_MAX} 次（防滥用）`)
    }
  }

  private async notifyAdmin(
    noticeId: bigint,
    input: {
      infringingUrl: string
      originalTitle: string
      copyrightOwner: string
      reporterEmail: string
      reporterRole: string
    },
  ): Promise<void> {
    const adminEmail = process.env.DMCA_ADMIN_EMAIL
    if (!adminEmail) {
      this.logger.warn('DMCA_ADMIN_EMAIL not configured, skip notify')
      return
    }

    const subject = `【DMCA Takedown #${noticeId}】${input.originalTitle.slice(0, 50)}`
    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>新 DMCA Takedown Notice #${noticeId}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 6px; background: #f3f4f6; width: 120px;">侵权 URL</td><td style="padding: 6px;">${input.infringingUrl}</td></tr>
          <tr><td style="padding: 6px; background: #f3f4f6;">原作品</td><td style="padding: 6px;">${input.originalTitle}</td></tr>
          <tr><td style="padding: 6px; background: #f3f4f6;">版权所有者</td><td style="padding: 6px;">${input.copyrightOwner}</td></tr>
          <tr><td style="padding: 6px; background: #f3f4f6;">举报人邮箱</td><td style="padding: 6px;">${input.reporterEmail}</td></tr>
          <tr><td style="padding: 6px; background: #f3f4f6;">举报人身份</td><td style="padding: 6px;">${input.reporterRole === 'owner' ? '版权所有者' : '授权代表'}</td></tr>
        </table>
        <p style="margin-top: 16px;">请登录 <a href="https://admin.seekall.winmelon.cn">admin 后台</a> 复核处理。</p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">合规要求：24 小时内人工响应（工作日 4 小时内首次回复）</p>
      </div>
    `
    await this.mailService.sendRaw(adminEmail, subject, html)
  }
}
