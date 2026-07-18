import { Module } from '@nestjs/common'
import { RuleController, AdminRuleController } from './rule.controller'
import { RuleService } from './rule.service'

@Module({
  controllers: [RuleController, AdminRuleController],
  providers: [RuleService],
  exports: [RuleService],
})
export class RuleModule {}
