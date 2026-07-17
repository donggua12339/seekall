import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { REDIS_CLIENT } from '../../database/redis.module'
import type Redis from 'ioredis'

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async check(): Promise<{
    status: string
    services: Record<string, string>
    timestamp: string
  }> {
    const services: Record<string, string> = {}

    // MySQL
    try {
      await this.prisma.$queryRaw`SELECT 1`
      services.mysql = 'ok'
    } catch (err) {
      services.mysql = `error: ${(err as Error).message}`
    }

    // Redis
    try {
      const pong = await this.redis.ping()
      services.redis = pong === 'PONG' ? 'ok' : 'error'
    } catch (err) {
      services.redis = `error: ${(err as Error).message}`
    }

    const allOk = Object.values(services).every((s) => s === 'ok')
    return {
      status: allOk ? 'ok' : 'degraded',
      services,
      timestamp: new Date().toISOString(),
    }
  }
}
