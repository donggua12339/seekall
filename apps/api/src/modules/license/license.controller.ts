import { Body, Controller, Post } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { LicenseService } from './license.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { IsString } from 'class-validator'

class RedeemDto {
  @IsString() code!: string
}

class WmWebhookDto {
  @IsString() wmOrderId!: string
  @IsString() tier!: 'trial' | 'monthly' | 'lifetime'
  amount!: number
  @IsString() signature!: string
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

  @Post('wm-webhook')
  @ApiOperation({ summary: 'WM 发卡网 webhook 回调（W2 半自动同步）' })
  wmWebhook(@Body() dto: WmWebhookDto) {
    return this.service.handleWmWebhook(dto)
  }
}
