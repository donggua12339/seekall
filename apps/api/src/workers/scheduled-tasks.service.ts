import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import * as Sentry from '@sentry/node'
import { LinkCheckerService } from '../modules/link-checker/link-checker.service'
import { SearchService } from '../modules/search/search.service'
import { HealthService } from '../modules/health/health.service'
import { SubscriptionService } from '../modules/subscription/subscription.service'
import { ProviderService } from '../modules/provider/provider.service'
import { PrismaService } from '../database/prisma.service'

@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name)
  private healthCheckFailures = 0

  constructor(
    private readonly linkCheckerService: LinkCheckerService,
    private readonly searchService: SearchService,
    private readonly healthService: HealthService,
    private readonly subscriptionService: SubscriptionService,
    private readonly providerService: ProviderService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 每天凌晨 3:00 执行失效链接批量检测
   */
  @Cron(process.env.LINK_CHECKER_INTERVAL || '0 3 * * *')
  async runLinkCheck() {
    this.logger.log('Starting scheduled link check...')
    try {
      await this.linkCheckerService.scheduleBatchCheck(7, 1000)
      this.logger.log('Scheduled link check completed')
    } catch (err) {
      this.logger.error(`Scheduled link check failed: ${(err as Error).message}`)
      Sentry.captureException(err, { tags: { task: 'link-check' } })
    }
  }

  /**
   * 每 5 分钟健康检查告警
   * 连续 3 次失败上报 Sentry
   */
  @Cron('*/5 * * * *')
  async healthCheck() {
    try {
      const result = await this.healthService.check()
      if (result.status === 'ok') {
        if (this.healthCheckFailures > 0) {
          this.logger.log(`Services recovered after ${this.healthCheckFailures} failures`)
        }
        this.healthCheckFailures = 0
        return
      }

      // degraded 或有服务异常
      this.healthCheckFailures++
      this.logger.warn(
        `Health check degraded (${this.healthCheckFailures}): ${JSON.stringify(result.services)}`,
      )

      // 连续 3 次失败上报 Sentry
      if (this.healthCheckFailures >= 3) {
        Sentry.captureMessage(
          `Services degraded: ${JSON.stringify(result.services)}`,
          'warning',
        )
      }
    } catch (err) {
      this.healthCheckFailures++
      this.logger.error(`Health check failed: ${(err as Error).message}`)
      if (this.healthCheckFailures >= 3) {
        Sentry.captureException(err, { tags: { task: 'health-check' } })
      }
    }
  }

  /**
   * 每小时整点预热热门搜索关键词
   * 从最近 7 天搜索日志统计 top 20，预缓存结果
   */
  @Cron(CronExpression.EVERY_HOUR)
  async warmupPopularSearches() {
    try {
      const result = await this.searchService.warmupPopularKeywords(20)
      if (result.total > 0) {
        this.logger.log(
          `Popular search warmup: ${result.succeeded}/${result.total} succeeded`,
        )
      }
    } catch (err) {
      this.logger.error(`Popular search warmup failed: ${(err as Error).message}`)
    }
  }

  /**
   * 每天凌晨 4:00 清理过期搜索日志（90 天前）
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async cleanSearchLogs() {
    this.logger.log('Cleaning search logs older than 90 days...')
    try {
      const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      const result = await this.prisma.searchLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      })
      this.logger.log(`Cleaned ${result.count} search logs`)
    } catch (err) {
      this.logger.error(`Clean search logs failed: ${(err as Error).message}`)
    }
  }

  /**
   * 每月 1 日 4:30 清理过期审计日志（1 年前）
   */
  @Cron('30 4 1 * *')
  async cleanAuditLogs() {
    this.logger.log('Cleaning audit logs older than 1 year...')
    try {
      const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      const result = await this.prisma.adminAuditLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      })
      this.logger.log(`Cleaned ${result.count} audit logs`)
    } catch (err) {
      this.logger.error(`Clean audit logs failed: ${(err as Error).message}`)
    }
  }

  /**
   * 每 2 小时检查关键词订阅，有新资源则邮件通知
   */
  @Cron(process.env.SUBSCRIPTION_CHECK_INTERVAL || '0 */2 * * *')
  async checkSubscriptions() {
    this.logger.log('Checking keyword subscriptions...')
    try {
      const result = await this.subscriptionService.checkAllSubscriptions()
      if (result.checked > 0) {
        this.logger.log(
          `Subscription check: ${result.checked} checked, ${result.notified} notified, ${result.failed} failed`,
        )
      }
    } catch (err) {
      this.logger.error(`Subscription check failed: ${(err as Error).message}`)
      Sentry.captureException(err, { tags: { task: 'subscription-check' } })
    }
  }

  /**
   * 每 10 分钟尝试恢复自动降级的 Provider
   */
  @Cron('*/10 * * * *')
  async autoRecoverProviders() {
    try {
      const result = await this.providerService.autoRecover()
      if (result.recovered.length > 0) {
        this.logger.log(`Providers auto-recovered: ${result.recovered.join(', ')}`)
      }
    } catch (err) {
      this.logger.error(`Provider auto-recover failed: ${(err as Error).message}`)
    }
  }
}
