import { Module } from '@nestjs/common'
import { SubscriptionService } from './subscription.service'
import { SubscriptionController } from './subscription.controller'
import { MailModule } from '../mail/mail.module'
import { SearchModule } from '../search/search.module'

@Module({
  imports: [MailModule, SearchModule],
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
