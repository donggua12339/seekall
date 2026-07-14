import { Body, Controller, Get, Patch, Post, Query, Param, ParseIntPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { AdminService } from './admin.service'
import { ProviderService } from '../provider/provider.service'
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

class AnalyticsDto {
  @IsInt() @Min(1) @Max(90) days: number = 7
}

class ProviderActionDto {
  @IsString() name!: string
}

@ApiTags('后台管理（super_admin）')
@ApiBearerAuth()
@Roles('super_admin')
@Controller('admin')
export class AdminController {
  constructor(
    private readonly service: AdminService,
    private readonly providerService: ProviderService,
  ) {}

  @Get('dashboard')
  @ApiOperation({ summary: '控制台数据' })
  dashboard() {
    return this.service.dashboard()
  }

  @Get('analytics')
  @ApiOperation({ summary: '用户行为分析（搜索趋势/热门词/活跃用户）' })
  analytics(@Query() dto: AnalyticsDto) {
    return this.service.analytics(dto.days)
  }

  @Get('provider-stats')
  @ApiOperation({ summary: 'Provider 健康度评分（含自动降级状态）' })
  providerStats() {
    return { providers: this.providerService.getStats() }
  }

  @Post('providers/:name/disable')
  @ApiOperation({ summary: '手动禁用 Provider' })
  disableProvider(@Param('name') name: string, @Body() dto: ProviderActionDto) {
    const ok = this.providerService.disableProvider(name, dto.name || 'manual')
    return { ok, message: ok ? '已禁用' : '已处于禁用状态' }
  }

  @Post('providers/:name/enable')
  @ApiOperation({ summary: '手动恢复 Provider' })
  enableProvider(@Param('name') name: string) {
    const ok = this.providerService.enableProvider(name)
    return { ok, message: ok ? '已恢复' : '该 Provider 未被禁用' }
  }

  @Post('providers/recover-check')
  @ApiOperation({ summary: '立即执行 Provider 自动恢复检查' })
  async recoverProviders() {
    return this.providerService.autoRecover()
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

  @Get('audit-logs')
  @ApiOperation({ summary: '管理员审计日志' })
  auditLogs(@Query() dto: ListUsersDto) {
    return this.service.auditLogs(dto.page, dto.pageSize)
  }
}
