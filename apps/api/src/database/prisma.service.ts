import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)
  private connected = false

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    })
  }

  async onModuleInit() {
    try {
      await this.$connect()
      this.connected = true
      this.logger.log('Prisma connected to database')
    } catch (err) {
      this.logger.error(`Prisma connect failed: ${(err as Error).message}`)
      this.logger.warn('Running in degraded mode (no database)')
    }
  }

  async onModuleDestroy() {
    if (this.connected) {
      await this.$disconnect()
      this.logger.log('Prisma disconnected')
    }
  }

  isAvailable(): boolean {
    return this.connected
  }
}
