import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { LinkCheckerController } from './link-checker.controller'
import { LinkCheckerService } from './link-checker.service'
import { LinkCheckerProcessor } from './link-checker.processor'

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'link-checker',
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    }),
  ],
  controllers: [LinkCheckerController],
  providers: [LinkCheckerService, LinkCheckerProcessor],
  exports: [LinkCheckerService],
})
export class LinkCheckerModule {}
