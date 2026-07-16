import { Module } from '@nestjs/common'
import { TgAlertService } from './tg-alert.service'

@Module({
  providers: [TgAlertService],
  exports: [TgAlertService],
})
export class TgAlertModule {}
