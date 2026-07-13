import { Module } from '@nestjs/common'
import { BlockedKeywordController } from './blocked-keyword.controller'
import { BlockedKeywordService } from './blocked-keyword.service'

@Module({
  controllers: [BlockedKeywordController],
  providers: [BlockedKeywordService],
  exports: [BlockedKeywordService],
})
export class BlockedKeywordModule {}
