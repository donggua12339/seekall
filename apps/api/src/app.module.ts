import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ConfigModule } from '@nestjs/config'
import { BullModule } from '@nestjs/bullmq'
import { ScheduleModule } from '@nestjs/schedule'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { PrismaModule } from './database/prisma.module'
import { RedisModule } from './database/redis.module'
import { AuthModule } from './modules/auth/auth.module'
import { UserModule } from './modules/user/user.module'
import { AdminModule } from './modules/admin/admin.module'
import { RuleModule } from './modules/rule/rule.module'
import { LicenseModule } from './modules/license/license.module'
import { DmcaModule } from './modules/dmca/dmca.module'
import { HealthModule } from './modules/health/health.module'
import { SearchModule } from './modules/search/search.module'
import { MailModule } from './modules/mail/mail.module'
import { envValidation } from './config/env.validation'

@Module({
  imports: [
    // 配置
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      validationSchema: envValidation,
    }),

    // Redis（BullMQ + 缓存共用）
    BullModule.forRootAsync({
      useFactory: () => {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
        const url = new URL(redisUrl)
        return {
          connection: {
            host: url.hostname,
            port: parseInt(url.port || '6379'),
            password: url.password || undefined,
          },
        }
      },
    }),

    ScheduleModule.forRoot(),

    // 限流（全局兜底 100 次/分钟/IP，敏感端点用 @Throttle 覆盖）
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),

    // 基础设施
    PrismaModule,
    RedisModule,
    MailModule,

    // v0.5 业务模块（5 个 + health + dmca）
    AuthModule,
    UserModule,
    AdminModule,
    RuleModule,
    LicenseModule,
    DmcaModule,
    SearchModule,
    HealthModule,
  ],
  providers: [
    // 全局限流 Guard（与 JwtAuthGuard 并列 APP_GUARD，ThrottlerGuard 先注册先执行）
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
