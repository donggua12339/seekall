import { Injectable, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { PrismaService } from '../../database/prisma.service'
import { createHash } from 'crypto'

@Injectable()
export class LinkCheckerService {
  private readonly logger = new Logger(LinkCheckerService.name)

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('link-checker') private readonly queue: Queue,
  ) {}

  /**
   * 调度失效链接检测任务（由 cron 触发）
   * 每次检测最近 N 天内出现过的链接
   */
  async scheduleBatchCheck(days: number = 7, limit: number = 1000): Promise<void> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    const links = await this.prisma.linkStatusRecord.findMany({
      where: {
        OR: [
          { status: 'unknown' },
          { status: 'active', lastCheckedAt: { lt: since } },
          { status: 'checking', updatedAt: { lt: since } },
        ],
      },
      take: limit,
      orderBy: { lastCheckedAt: 'asc' },
      select: { id: true, url: true },
    })

    for (const link of links) {
      await this.queue.add('check', { id: link.id, url: link.url }, { delay: Math.random() * 5000 })
    }

    this.logger.log(`Scheduled ${links.length} link checks`)
  }

  /**
   * 用户手动举报链接失效
   */
  async reportDead(url: string): Promise<void> {
    const urlHash = createHash('md5').update(url).digest('hex')

    const existing = await this.prisma.linkStatusRecord.findUnique({
      where: { urlHash },
    })

    if (existing) {
      const newFailCount = existing.failCount + 1
      await this.prisma.linkStatusRecord.update({
        where: { id: existing.id },
        data: {
          failCount: newFailCount,
          status: newFailCount >= 3 ? 'dead' : existing.status,
          lastCheckedAt: new Date(),
        },
      })
    } else {
      await this.prisma.linkStatusRecord.create({
        data: {
          urlHash,
          url,
          status: 'dead',
          failCount: 3,
          lastCheckedAt: new Date(),
        },
      })
    }
  }

  async getStatus(url: string): Promise<string | null> {
    const urlHash = createHash('md5').update(url).digest('hex')
    const link = await this.prisma.linkStatusRecord.findUnique({
      where: { urlHash },
      select: { status: true },
    })
    return link?.status ?? null
  }
}
