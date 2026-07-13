import { Global, Module, OnModuleInit, Logger } from '@nestjs/common'
import { Redis } from 'ioredis'

export const REDIS_CLIENT = Symbol('REDIS_CLIENT')

@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => {
        const url = process.env.REDIS_URL || 'redis://localhost:6379'
        const client = new Redis(url, {
          maxRetriesPerRequest: 3,
          enableReadyCheck: true,
        })
        const logger = new Logger('RedisClient')
        client.on('connect', () => logger.log('Redis connected'))
        client.on('error', (err) => logger.error(`Redis error: ${err.message}`))
        return client
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule implements OnModuleInit {
  onModuleInit() {
    // 连接由工厂触发
  }
}
