import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { MailService } from '../mail/mail.service'
import { SearchService } from '../search/search.service'
import { BusinessException } from '../../common/filters/http-exception.filter'
import { ErrorCode } from '../../common/constants/error-codes'

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly searchService: SearchService,
  ) {}

  async list(userId: bigint) {
    return this.prisma.subscription.findMany({
      where: { userId, active: true },
      orderBy: { createdAt: 'desc' },
    })
  }

  async create(userId: bigint, keyword: string, notifyEmail: boolean = true) {
    const trimmed = keyword.trim()
    if (!trimmed) {
      throw new BusinessException(ErrorCode.PARAM_ERROR, 400, '关键词不能为空')
    }
    if (trimmed.length > 100) {
      throw new BusinessException(ErrorCode.PARAM_ERROR, 400, '关键词过长')
    }

    // 唯一约束：同用户同关键词只能订阅一次
    const existing = await this.prisma.subscription.findUnique({
      where: { userId_keyword: { userId, keyword: trimmed } },
    })
    if (existing) {
      if (existing.active) {
        throw new BusinessException(ErrorCode.PARAM_ERROR, 400, '已订阅过该关键词')
      }
      // 重新激活
      return this.prisma.subscription.update({
        where: { id: existing.id },
        data: { active: true, notifyEmail },
      })
    }

    return this.prisma.subscription.create({
      data: { userId, keyword: trimmed, notifyEmail },
    })
  }

  async delete(userId: bigint, id: bigint) {
    const sub = await this.prisma.subscription.findUnique({ where: { id } })
    if (!sub || sub.userId !== userId) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404)
    }
    await this.prisma.subscription.delete({ where: { id } })
    return { message: '已取消订阅' }
  }

  /**
   * 检查所有活跃订阅，发现新资源则通知用户
   * 由定时任务每小时调用
   */
  async checkAllSubscriptions(): Promise<{
    checked: number
    notified: number
    failed: number
  }> {
    if (!this.prisma.isAvailable()) {
      return { checked: 0, notified: 0, failed: 0 }
    }

    const subscriptions = await this.prisma.subscription.findMany({
      where: { active: true },
      include: {
        user: { select: { id: true, email: true, username: true } },
      },
      take: 200, // 单次最多处理 200 条，避免一次性压力过大
    })

    this.logger.log(`Checking ${subscriptions.length} active subscriptions...`)

    let notified = 0
    let failed = 0

    for (const sub of subscriptions) {
      try {
        // 跳过最近 1 小时内已通知过的（防止短时间重复推送）
        if (sub.lastNotifiedAt && Date.now() - sub.lastNotifiedAt.getTime() < 3600000) {
          continue
        }

        const result = await this.searchService.search(
          { keyword: sub.keyword, page: 1, pageSize: 20 },
          null,
        )

        // 有新结果（数量增加 或 第一次通知）
        if (result.total > 0 && result.total > sub.lastResultCount) {
          const newCount = result.total - sub.lastResultCount
          if (sub.notifyEmail && sub.user.email) {
            await this.mailService
              .sendSubscriptionNotification(
                sub.user.email,
                sub.user.username,
                sub.keyword,
                result.total,
                newCount,
                result.list.slice(0, 5).map((r) => ({ title: r.title, url: r.url })),
              )
              .catch((err) => {
                this.logger.warn(`Notify ${sub.user.email} failed: ${(err as Error).message}`)
              })
          }
          notified++

          await this.prisma.subscription.update({
            where: { id: sub.id },
            data: {
              lastNotifiedAt: new Date(),
              lastResultCount: result.total,
            },
          })
        }
      } catch (err) {
        failed++
        this.logger.debug(
          `Check subscription ${sub.id} (${sub.keyword}) failed: ${(err as Error).message}`,
        )
      }
    }

    this.logger.log(
      `Subscription check done: ${subscriptions.length} checked, ${notified} notified, ${failed} failed`,
    )
    return { checked: subscriptions.length, notified, failed }
  }
}
