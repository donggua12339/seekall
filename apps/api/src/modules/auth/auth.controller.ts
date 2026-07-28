import { Body, Controller, Get, Post, HttpCode, HttpStatus } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { IsString, Length } from 'class-validator'
import { AuthService } from './auth.service'
import { Public } from '../../common/decorators/public.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import {
  RegisterDto,
  LoginDto,
  VerifyEmailDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  RefreshTokenDto,
} from './dto'

class VerifyEmailCodeDto {
  @IsString()
  @Length(6, 6, { message: '验证码为 6 位数字' })
  code!: string
}

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: '注册（v0.5 半公开，不强制邀请码）' })
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: '登录' })
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.username, dto.password)
  }

  @Public()
  @Post('verify-email')
  @ApiOperation({ summary: '邮箱验证' })
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto.token)
  }

  @Public()
  @Post('password-reset/request')
  @ApiOperation({ summary: '申请密码重置' })
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email)
  }

  @Public()
  @Post('password-reset/confirm')
  @ApiOperation({ summary: '确认密码重置' })
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword)
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: '刷新 Token' })
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken)
  }

  @Public()
  @Get('verify-mode')
  @ApiOperation({ summary: '查询当前邮箱验证模式（code/link）' })
  getVerifyMode() {
    return this.authService.getEmailVerifyModePublic()
  }

  @ApiBearerAuth()
  @Post('verify-email-code')
  @ApiOperation({ summary: '验证码模式：校验 6 位验证码' })
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  verifyEmailCode(@Body() dto: VerifyEmailCodeDto, @CurrentUser('sub') userId: string) {
    return this.authService.verifyEmailCode(BigInt(userId), dto.code)
  }

  @ApiBearerAuth()
  @Post('resend-verification')
  @ApiOperation({ summary: '重发验证邮件' })
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  resendVerification(@CurrentUser('sub') userId: string) {
    return this.authService.resendVerification(BigInt(userId))
  }
}
