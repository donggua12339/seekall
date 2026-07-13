import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { BullModule } from '@nestjs/bullmq'
import { ScheduleModule } from '@nestjs/schedule'
import { PrismaModule } from './database/prisma.module'
import { RedisModule } from './database/redis.module'
import { AuthModule } from './modules/auth/auth.module'
import { UserModule } from './modules/user/user.module'
import { InviteCodeModule } from './modules/invite-code/invite-code.module'
import { MembershipCodeModule } from './modules/membership-code/membership-code.module'
import { SearchModule } from './modules/search/search.module'
import { ProviderModule } from './modules/provider/provider.module'
import { SearchHistoryModule } from './modules/search-history/search-history.module'
import { FavoriteModule } from './modules/favorite/favorite.module'
import { TakedownModule } from './modules/takedown/takedown.module'
import { BlockedKeywordModule } from './modules/blocked-keyword/blocked-keyword.module'
import { LinkCheckerModule } from './modules/link-checker/link-checker.module'
import { AdminModule } from './modules/admin/admin.module'
import { AgreementModule } from './modules/agreement/agreement.module'
import { HealthModule } from './modules/health/health.module'
import { MailModule } from './modules/mail/mail.module'
import { MeilisearchModule } from './modules/meilisearch/meilisearch.module'
import { ScheduledTasksService } from './workers/scheduled-tasks.service'
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
    MeilisearchModule,
    MailModule,

    // 业务模块
    AuthModule,
    UserModule,
    InviteCodeModule,
    MembershipCodeModule,
    SearchModule,
    ProviderModule,
    SearchHistoryModule,
    FavoriteModule,
    TakedownModule,
    BlockedKeywordModule,
    LinkCheckerModule,
    AdminModule,
    AgreementModule,
    HealthModule,
  ],
  providers: [ScheduledTasksService],
})
export class AppModule {}
