import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { BullModule } from '@nestjs/bullmq'
import { ScheduleModule } from '@nestjs/schedule'
import { PrismaModule } from './database/prisma.module'
import { RedisModule } from './database/redis.module'
import { AuthModule } from './modules/auth/auth.module'
import { UserModule } from './modules/user/user.module'
import { AdminModule } from './modules/admin/admin.module'
import { RuleModule } from './modules/rule/rule.module'
import { LicenseModule } from './modules/license/license.module'
import { DmcaModule } from './modules/dmca/dmca.module'
import { HealthModule } from './modules/health/health.module'
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
    HealthModule,
  ],
})
export class AppModule {}
