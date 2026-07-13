import { Module } from '@nestjs/common'
import { MembershipCodeController } from './membership-code.controller'
import { MembershipCodeService } from './membership-code.service'

@Module({
  controllers: [MembershipCodeController],
  providers: [MembershipCodeService],
  exports: [MembershipCodeService],
})
export class MembershipCodeModule {}
