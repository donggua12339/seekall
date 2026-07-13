import { Module } from '@nestjs/common'
import { CloudAccountController } from './cloud-account.controller'
import { CloudAccountService } from './cloud-account.service'

@Module({
  controllers: [CloudAccountController],
  providers: [CloudAccountService],
  exports: [CloudAccountService],
})
export class CloudAccountModule {}
