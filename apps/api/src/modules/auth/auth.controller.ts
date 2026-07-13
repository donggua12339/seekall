import { Body, Controller, Post, Get, HttpCode, HttpStatus, UseGuards, Req, Res } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { AuthGuard } from '@nestjs/passport'
import { FastifyReply, FastifyRequest } from 'fastify'
import { AuthService } from './auth.service'
import { Public } from '../../common/decorators/public.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { GithubProfile } from './github.strategy'
import {
  RegisterDto,
  LoginDto,
  VerifyEmailDto,
  RequestPasswordResetDto,
  ResetPasswordDto,
  RefreshTokenDto,
} from './dto'

@ApiTags('认证')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: '注册（需要邀请码）' })
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto)
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: '登录' })
  @HttpCode(HttpStatus.OK)
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
  requestPasswordReset(@Body() dto: RequestPasswordResetDto) {
    return this.authService.requestPasswordReset(dto.email)
  }

  @Public()
  @Post('password-reset/confirm')
  @ApiOperation({ summary: '确认密码重置' })
  @HttpCode(HttpStatus.OK)
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

  // ====== GitHub OAuth（v0.2）======

  @Public()
  @Get('github')
  @ApiOperation({ summary: 'GitHub OAuth 登录（重定向到 GitHub）' })
  @UseGuards(AuthGuard('github'))
  github() {
    // AuthGuard 会自动重定向到 GitHub
  }

  @Public()
  @Get('github/callback')
  @ApiOperation({ summary: 'GitHub OAuth 回调' })
  @UseGuards(AuthGuard('github'))
  async githubCallback(@Req() req: FastifyRequest, @Res() reply: FastifyReply) {
    const profile = (req as unknown as { user: GithubProfile }).user
    const result = await this.authService.githubAuth(profile)

    if (result.action === 'login' && result.tokens) {
      // 已绑定用户 -> 直接登录，重定向到前端首页（token 通过 query 传递）
      const frontendUrl = process.env.WEB_URL || 'http://localhost:3001'
      const redirectUrl = `${frontendUrl}/auth/github-success?token=${encodeURIComponent(result.tokens.accessToken)}&refresh=${encodeURIComponent(result.tokens.refreshToken)}`
      reply.redirect(redirectUrl)
    } else {
      // 未绑定 -> 重定向到注册页，带 GitHub profile 信息
      const frontendUrl = process.env.WEB_URL || 'http://localhost:3001'
      const profileData = encodeURIComponent(JSON.stringify(result.githubProfile))
      const redirectUrl = `${frontendUrl}/auth/register?github=${profileData}`
      reply.redirect(redirectUrl)
    }
  }

  @ApiBearerAuth()
  @Post('github/bind')
  @ApiOperation({ summary: '绑定 GitHub 账号（需登录，个人主页操作）' })
  @UseGuards(AuthGuard('github'))
  async bindGithub(@CurrentUser('sub') userId: string, @Req() req: FastifyRequest) {
    const profile = (req as unknown as { user: GithubProfile }).user
    return this.authService.bindGithub(BigInt(userId), profile)
  }

  @ApiBearerAuth()
  @Post('github/unbind')
  @ApiOperation({ summary: '解绑 GitHub 账号' })
  unbindGithub(@CurrentUser('sub') userId: string) {
    return this.authService.unbindGithub(BigInt(userId))
  }
}
