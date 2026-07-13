import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Logger } from '@nestjs/common'
import { Job } from 'bullmq'
import { PrismaService } from '../../database/prisma.service'

@Processor('link-checker', { concurrency: 10 })
export class LinkCheckerProcessor extends WorkerHost {
  private readonly logger = new Logger(LinkCheckerProcessor.name)
  private readonly timeout = 5000

  constructor(private readonly prisma: PrismaService) {
    super()
  }

  async process(job: Job<{ id: bigint; url: string }>): Promise<void> {
    const { id, url } = job.data

    await this.prisma.linkStatusRecord.update({
      where: { id },
      data: { status: 'checking' },
    })

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: controller.signal,
      })

      clearTimeout(timer)

      const ok = response.ok || response.status === 405 // 部分网站不支持 HEAD，405 也算可达

      await this.prisma.linkStatusRecord.update({
        where: { id },
        data: {
          status: ok ? 'active' : 'dead',
          lastCheckedAt: new Date(),
          failCount: ok ? 0 : { increment: 1 },
        },
      })
    } catch (err) {
      await this.prisma.linkStatusRecord.update({
        where: { id },
        data: {
          status: 'dead',
          lastCheckedAt: new Date(),
          failCount: { increment: 1 },
        },
      })
      this.logger.debug(`Link check failed: ${url} - ${(err as Error).message}`)
    }
  }
}
