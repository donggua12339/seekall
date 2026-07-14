import { Module } from '@nestjs/common'
import { SubtitleController } from './subtitle.controller'
import { SubtitleService } from './subtitle.service'

@Module({
  controllers: [SubtitleController],
  providers: [SubtitleService],
  exports: [SubtitleService],
})
export class SubtitleModule {}
