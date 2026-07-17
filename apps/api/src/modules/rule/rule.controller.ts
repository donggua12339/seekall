import { Body, Controller, Get, Param, Post, Query, ParseIntPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { RuleService } from './rule.service'
import { Public } from '../../common/decorators/public.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { IsString, IsInt, Min, Max } from 'class-validator'

class ListRuleDto {
  @IsInt() @Min(1) page: number = 1
  @IsInt() @Min(1) @Max(100) pageSize: number = 20
  @IsInt() @Min(0) @Max(4) riskLevel?: number
}

class SubmitRuleDto {
  @IsString() npmPackage!: string
  @IsInt() @Min(0) @Max(4) riskLevel!: number
  @IsString() description!: string
}

@ApiTags('规则市场')
@Controller('rules')
export class RuleController {
  constructor(private readonly service: RuleService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: '规则列表（L0-L2 公开，L3/L4 仅 admin）' })
  list(@Query() dto: ListRuleDto, @CurrentUser('role') role?: string) {
    return this.service.list({
      page: dto.page,
      pageSize: dto.pageSize,
      riskLevel: dto.riskLevel,
      actorRole: role,
    })
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: '规则详情' })
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(BigInt(id))
  }

  @ApiBearerAuth()
  @Post()
  @ApiOperation({ summary: '提交规则到市场（L0/L1 自动上架，L2 评审）' })
  submit(@Body() dto: SubmitRuleDto, @CurrentUser('sub') userId: string) {
    return this.service.submit({
      npmPackage: dto.npmPackage,
      riskLevel: dto.riskLevel,
      description: dto.description,
      authorId: BigInt(userId),
    })
  }
}
