import { Body, Controller, Get, Patch, Post, Query, Param, ParseIntPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { AdminService } from './admin.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator'

class ListUsersDto {
  @IsInt() @Min(1) page: number = 1
  @IsInt() @Min(1) @Max(100) pageSize: number = 20
  @IsOptional() @IsString() search?: string
}

class BanDto {
  @IsString() reason!: string
}

class SetBadgeDto {
  @IsString() badge!: string
}

class AnalyticsDto {
  @IsInt() @Min(1) @Max(90) days: number = 7
}

class ListRefundsDto {
  @IsInt() @Min(1) page: number = 1
  @IsInt() @Min(1) @Max(100) pageSize: number = 20
  @IsOptional() @IsString() status?: string
}

class ReviewRefundDto {
  @IsOptional() @IsString() note?: string
}

class ReportDeadDto {
  @IsOptional() @IsString() note?: string
}

class SetEmailVerifyModeDto {
  @IsString() mode!: string
}

@ApiTags('后台管理（super_admin）')
@ApiBearerAuth()
@Roles('super_admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly service: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: '控制台数据' })
  dashboard() {
    return this.service.dashboard()
  }

  @Get('analytics')
  @ApiOperation({ summary: '用户行为分析（基于 license/rule 数据）' })
  analytics(@Query() dto: AnalyticsDto) {
    return this.service.analytics(dto.days)
  }

  @Get('users')
  @ApiOperation({ summary: '用户列表' })
  listUsers(@Query() dto: ListUsersDto) {
    return this.service.listUsers(dto.page, dto.pageSize, dto.search)
  }

  @Patch('users/:id/ban')
  @ApiOperation({ summary: '封禁用户' })
  banUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BanDto,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.service.banUser(BigInt(id), dto.reason, BigInt(adminId))
  }

  @Patch('users/:id/unban')
  @ApiOperation({ summary: '解封用户' })
  unbanUser(@Param('id', ParseIntPipe) id: number, @CurrentUser('sub') adminId: string) {
    return this.service.unbanUser(BigInt(id), BigInt(adminId))
  }

  @Patch('users/:id/badge')
  @ApiOperation({ summary: '设置用户徽章（contributor/reviewer/early_adopter）' })
  setUserBadge(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetBadgeDto,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.service.setUserBadge(BigInt(id), dto.badge, BigInt(adminId))
  }

  @Get('audit-logs')
  @ApiOperation({ summary: '管理员审计日志' })
  auditLogs(@Query() dto: ListUsersDto) {
    return this.service.auditLogs(dto.page, dto.pageSize)
  }

  @Get('transparency')
  @ApiOperation({ summary: '透明度报告(上月 takedown 统计)' })
  transparency() {
    return this.service.transparencyReport()
  }

  @Get('refunds')
  @ApiOperation({ summary: '退款申请列表' })
  listRefunds(@Query() dto: ListRefundsDto) {
    return this.service.listRefunds(dto.page, dto.pageSize, dto.status)
  }

  @Post('refunds/:id/approve')
  @ApiOperation({ summary: '批准退款' })
  approveRefund(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') adminId: string,
    @Body() dto: ReviewRefundDto,
  ) {
    return this.service.reviewRefund(BigInt(id), 'approve', BigInt(adminId), dto.note)
  }

  @Post('refunds/:id/reject')
  @ApiOperation({ summary: '拒绝退款' })
  rejectRefund(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('sub') adminId: string,
    @Body() dto: ReviewRefundDto,
  ) {
    return this.service.reviewRefund(BigInt(id), 'reject', BigInt(adminId), dto.note)
  }

  @Get('settings/email-verify-mode')
  @ApiOperation({ summary: '获取邮箱验证模式' })
  getEmailVerifyMode() {
    return this.service.getEmailVerifyMode()
  }

  @Patch('settings/email-verify-mode')
  @ApiOperation({ summary: '设置邮箱验证模式（code=验证码 / link=验证链接）' })
  setEmailVerifyMode(@Body() dto: SetEmailVerifyModeDto, @CurrentUser('sub') adminId: string) {
    return this.service.setEmailVerifyMode(dto.mode as 'code' | 'link', BigInt(adminId))
  }
}

@ApiTags('S4 失效举报')
@ApiBearerAuth()
@Controller('admin/rules')
export class ReportDeadRuleController {
  constructor(private readonly service: AdminService) {}

  @Post(':id/report-dead')
  @ApiOperation({ summary: '用户举报规则失效（累计 3 次自动隐藏）' })
  reportDead(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReportDeadDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.reportDeadRule({
      ruleId: BigInt(id),
      userId: BigInt(userId),
      note: dto.note,
    })
  }
}
