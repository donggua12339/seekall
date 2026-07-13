import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { LinkCheckerService } from '../modules/link-checker/link-checker.service'
import { PrismaService } from '../database/prisma.service'

@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name)

  constructor(
    private readonly linkCheckerService: LinkCheckerService,
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
}
