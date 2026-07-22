import { Body, Controller, Get, Param, Post, Delete, Query, ParseIntPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { RuleService } from './rule.service'
import { Public } from '../../common/decorators/public.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { IsString, IsInt, Min, Max, IsBoolean, IsOptional } from 'class-validator'

class ListRuleDto {
  @IsInt() @Min(1) page: number = 1
  @IsInt() @Min(1) @Max(100) pageSize: number = 20
  @IsOptional() @IsInt() @Min(0) @Max(4) riskLevel?: number
}

class SubmitRuleDto {
  @IsString() npmPackage!: string
  @IsInt() @Min(0) @Max(4) riskLevel!: number
  @IsString() description!: string
}

class ReviewDto {
  @IsBoolean() approve!: boolean
  @IsOptional() @IsString() comment?: string
}

class FinalReviewDto {
  @IsBoolean() approve!: boolean
  @IsOptional() @IsString() note?: string
}

class TakedownDto {
  @IsString() reason!: string
}

class AdminCreateRuleDto {
  @IsString() npmPackage!: string
  @IsInt() @Min(3) @Max(4) riskLevel!: number
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

  @Public()
  @Get('contributors/list')
  @ApiOperation({ summary: '贡献者排行榜（公开，按 published 规则数排序）' })
  contributors() {
    return this.service.contributors()
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

  @ApiBearerAuth()
  @Post(':id/review')
  @ApiOperation({ summary: 'E 社群评审：评审 L2 规则（需付费会员）' })
  review(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.review({
      ruleId: BigInt(id),
      reviewerId: BigInt(userId),
      approve: dto.approve,
      comment: dto.comment,
    })
  }

  @ApiBearerAuth()
  @Post(':id/subscribe')
  @ApiOperation({ summary: '订阅规则（同步到 SDK 配置）' })
  subscribe(@Param('id', ParseIntPipe) id: number, @CurrentUser('sub') userId: string) {
    return this.service.subscribe(BigInt(id), BigInt(userId))
  }

  @ApiBearerAuth()
  @Delete(':id/subscribe')
  @ApiOperation({ summary: '取消订阅规则' })
  unsubscribe(@Param('id', ParseIntPipe) id: number, @CurrentUser('sub') userId: string) {
    return this.service.unsubscribe(BigInt(id), BigInt(userId))
  }

  @ApiBearerAuth()
  @Get('my/subscriptions')
  @ApiOperation({ summary: '我订阅的规则（SDK 拉取）' })
  mySubscriptions(@CurrentUser('sub') userId: string) {
    return this.service.mySubscriptions(BigInt(userId))
  }

  @ApiBearerAuth()
  @Get('my/submitted')
  @ApiOperation({ summary: '我提交的规则（含所有状态，贡献者跟踪审核进度）' })
  mySubmitted(@CurrentUser('sub') userId: string) {
    return this.service.mySubmitted(BigInt(userId))
  }
}

@ApiTags('后台管理 - Rule（super_admin）')
@ApiBearerAuth()
@Roles('super_admin')
@Controller('admin/rules')
export class AdminRuleController {
  constructor(private readonly service: RuleService) {}

  @Post()
  @ApiOperation({ summary: 'Admin 创建 L3/L4 规则（仅审计用）' })
  create(@Body() dto: AdminCreateRuleDto, @CurrentUser('sub') adminId: string) {
    return this.service.adminCreate({
      npmPackage: dto.npmPackage,
      riskLevel: dto.riskLevel,
      description: dto.description,
      adminId: BigInt(adminId),
    })
  }

  @Post(':id/final-review')
  @ApiOperation({ summary: 'Admin 终审 L2 规则' })
  finalReview(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FinalReviewDto,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.service.finalReview({
      ruleId: BigInt(id),
      adminId: BigInt(adminId),
      approve: dto.approve,
      note: dto.note,
    })
  }

  @Get(':id/reviews')
  @ApiOperation({ summary: 'Admin 查看规则评审详情(投票 + 评论)' })
  listReviews(@Param('id', ParseIntPipe) id: number) {
    return this.service.listReviews(BigInt(id))
  }

  @Post(':id/takedown')
  @ApiOperation({ summary: 'DMCA Takedown 规则（累计 3 次封禁作者）' })
  takedown(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TakedownDto,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.service.takedown({
      ruleId: BigInt(id),
      adminId: BigInt(adminId),
      reason: dto.reason,
    })
  }
}
