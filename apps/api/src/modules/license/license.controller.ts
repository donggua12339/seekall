import { Body, Controller, Get, Param, Post, Query, ParseIntPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { LicenseService } from './license.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { IsString, IsInt, IsOptional, Min, Max, IsIn, IsNumber } from 'class-validator'

class RedeemDto {
  @IsString() code!: string
}

class WmWebhookDto {
  @IsString() wmOrderId!: string
  @IsIn(['trial', 'monthly', 'lifetime']) tier!: 'trial' | 'monthly' | 'lifetime'
  @IsNumber() amount!: number
  @IsString() signature!: string
  /** WM 发给用户的卡密内容（UUID 或自定义字符串），可选。
   *  如果 WM 传了此字段，SeekAll 直接用它作为 license code，
   *  用户拿到 WM 卡密后可以直接 redeem。
   *  如果没传，SeekAll 自己生成 SA-XXX-XXXX 格式（旧逻辑兼容）。 */
  @IsOptional() @IsString() cardContent?: string
}

class GenerateCodeDto {
  @IsIn(['trial', 'monthly', 'lifetime']) tier!: 'trial' | 'monthly' | 'lifetime'
  @IsOptional() @IsString() note?: string
  @IsOptional() @IsInt() @Min(1) @Max(100) count?: number = 1
}

class ListLicenseDto {
  @IsInt() @Min(1) page: number = 1
  @IsInt() @Min(1) @Max(100) pageSize: number = 20
  @IsOptional() @IsIn(['unused', 'used', 'disabled']) status?: 'unused' | 'used' | 'disabled'
  @IsOptional() @IsIn(['trial', 'monthly', 'lifetime']) tier?: 'trial' | 'monthly' | 'lifetime'
}

@ApiTags('会员授权')
@Controller('license')
export class LicenseController {
  constructor(private readonly service: LicenseService) {}

  @ApiBearerAuth()
  @Post('redeem')
  @ApiOperation({ summary: '兑换 license code' })
  redeem(@Body() dto: RedeemDto, @CurrentUser('sub') userId: string) {
    return this.service.redeem(dto.code, BigInt(userId))
  }

  @ApiBearerAuth()
  @Post('invite-trial')
  @ApiOperation({ summary: '老用户生成 ¥1 试用邀请码（每月限 3 个）' })
  generateInviteTrial(@CurrentUser('sub') userId: string) {
    return this.service.generateInviteTrialCode(BigInt(userId))
  }

  @ApiBearerAuth()
  @Get('invite-trial/my')
  @ApiOperation({ summary: '查询本月邀请码用量 + 已生成列表' })
  myInviteTrial(@CurrentUser('sub') userId: string) {
    return this.service.myInviteTrialCodes(BigInt(userId))
  }

  @Public()
  @Post('wm-webhook')
  @ApiOperation({ summary: 'WM 发卡网 webhook 回调（W2 半自动同步）' })
  wmWebhook(@Body() dto: WmWebhookDto) {
    return this.service.handleWmWebhook(dto)
  }
}

@ApiTags('后台管理 - License（super_admin）')
@ApiBearerAuth()
@Roles('super_admin')
@Controller('admin/license')
export class AdminLicenseController {
  constructor(private readonly service: LicenseService) {}

  @Post('generate')
  @ApiOperation({ summary: 'W1: admin 手动生成 license code（支持批量）' })
  generate(@Body() dto: GenerateCodeDto, @CurrentUser('sub') adminId: string) {
    const count = dto.count || 1
    return Promise.all(
      Array.from({ length: count }, () =>
        this.service.generateCode({
          tier: dto.tier,
          generatedBy: BigInt(adminId),
          note: dto.note,
        }),
      ),
    )
  }

  @Get()
  @ApiOperation({ summary: 'License 列表（分页 + 过滤）' })
  list(@Query() dto: ListLicenseDto) {
    return this.service.list({
      page: dto.page,
      pageSize: dto.pageSize,
      status: dto.status,
      tier: dto.tier,
    })
  }

  @Get(':id')
  @ApiOperation({ summary: 'License 详情' })
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(BigInt(id))
  }

  @Post(':id/disable')
  @ApiOperation({ summary: '禁用 license code' })
  disable(@Param('id', ParseIntPipe) id: number) {
    return this.service.disable(BigInt(id))
  }
}
