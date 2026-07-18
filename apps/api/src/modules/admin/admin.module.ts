import { Module } from '@nestjs/common'
import { AdminController, ReportDeadRuleController } from './admin.controller'
import { AdminService } from './admin.service'

@Module({
  controllers: [AdminController, ReportDeadRuleController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
