import { Body, Controller, Get, Patch, Delete, Param, Post } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { UserService } from './user.service'
import { AuthService } from '../auth/auth.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { IsString, IsOptional, IsEmail, MaxLength, IsArray, IsObject } from 'class-validator'

class UpdateProfileDto {
  @IsOptional() @IsString() avatarUrl?: string
  @IsOptional() @IsString() bio?: string
}

class RequestReceiptDto {
  @IsString() @MaxLength(32) licenseCode!: string
  @IsString() @MaxLength(255) title!: string
  @IsEmail() email!: string
}

class RequestRefundDto {
  @IsString() @MaxLength(32) licenseCode!: string
  @IsString() @MaxLength(500) reason!: string
}

class SyncConfigDto {
  @IsOptional() @IsArray() @IsString({ each: true }) defaultRules?: string[]
  @IsOptional() @IsString() outputFormat?: string
  @IsOptional() @IsObject() customConfig?: Record<string, unknown>
}

@ApiTags('用户')
@ApiBearerAuth()
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @Get('profile')
  @ApiOperation({ summary: '获取个人信息' })
  getProfile(@CurrentUser('sub') userId: string) {
    return this.userService.getProfile(BigInt(userId))
  }

  @Patch('profile')
  @ApiOperation({ summary: '更新个人信息' })
  updateProfile(@CurrentUser('sub') userId: string, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(BigInt(userId), dto)
  }

  @Delete('account')
  @ApiOperation({ summary: '注销账号(软删除)' })
  deleteAccount(@CurrentUser('sub') userId: string) {
    return this.userService.deleteAccount(BigInt(userId))
  }

  @Get('sessions')
  @ApiOperation({ summary: '登录设备列表' })
  listSessions(@CurrentUser('sub') userId: string) {
    return this.authService.getSessions(BigInt(userId))
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: '踢出指定登录设备' })
  revokeSession(@CurrentUser('sub') userId: string, @Param('id') sessionId: string) {
    return this.authService.revokeSession(BigInt(userId), sessionId)
  }

  @Get('transactions')
  @ApiOperation({ summary: '我的交易记录(从 license 聚合,金额按 tier 推算)' })
  listTransactions(@CurrentUser('sub') userId: string) {
    return this.userService.getTransactions(BigInt(userId))
  }

  @Post('receipts')
  @ApiOperation({ summary: '申请电子收据(非税务发票,仅供报销参考)' })
  requestReceipt(@CurrentUser('sub') userId: string, @Body() dto: RequestReceiptDto) {
    return this.userService.requestReceipt(BigInt(userId), dto)
  }

  @Post('refunds')
  @ApiOperation({ summary: '申请退款(7 天内 + 已使用可退,admin 审核)' })
  requestRefund(@CurrentUser('sub') userId: string, @Body() dto: RequestRefundDto) {
    return this.userService.requestRefund(BigInt(userId), dto)
  }

  @Get('refunds')
  @ApiOperation({ summary: '我的退款申请列表' })
  listRefunds(@CurrentUser('sub') userId: string) {
    return this.userService.getMyRefunds(BigInt(userId))
  }

  @Get('sync')
  @ApiOperation({ summary: '云同步: 获取用户配置(默认规则 + 输出格式)' })
  getSync(@CurrentUser('sub') userId: string) {
    return this.userService.getSync(BigInt(userId))
  }

  @Post('sync')
  @ApiOperation({ summary: '云同步: 保存用户配置' })
  saveSync(@CurrentUser('sub') userId: string, @Body() dto: SyncConfigDto) {
    return this.userService.saveSync(BigInt(userId), dto)
  }
}
