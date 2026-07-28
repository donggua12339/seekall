import { Injectable, Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { Inject } from '@nestjs/common'
import { createHash, randomInt } from 'crypto'
import { PrismaService } from '../../database/prisma.service'
import { REDIS_CLIENT } from '../../database/redis.module'
import { MailService } from '../mail/mail.service'
import { HashUtil } from '../../common/utils/hash.util'
import { BusinessException } from '../../common/filters/http-exception.filter'
import { ErrorCode } from '../../common/constants/error-codes'
import { JwtPayload } from '../../common/guards/jwt-auth.guard'
import type Redis from 'ioredis'
import { User, UserRole, UserStatus } from '@prisma/client'

const EMAIL_VERIFY_CODE_PREFIX = 'email-verify-code:'
const EMAIL_VERIFY_CODE_TTL = 600 // 10 分钟

interface RegisterInput {
  username: string
  email: string
  password: string
  agreementVersion: string
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)
  private readonly refreshTtl = 7 * 24 * 60 * 60 // 7 天

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async register(input: RegisterInput): Promise<{
    code: number
    data: { message: string }
    message: string
  }> {
    // 校验用户名/邮箱唯一性
    // 特殊处理：如果已存在的用户是 pending_verification 状态（之前注册但邮件发送失败），
    // 删除旧记录允许重新注册
    const existsUsername = await this.prisma.user.findUnique({
      where: { username: input.username },
    })
    if (existsUsername) {
      if (existsUsername.status === UserStatus.pending_verification) {
        await this.prisma.user.delete({ where: { id: existsUsername.id } })
        this.logger.log(`Deleted stale pending user: ${input.username}`)
      } else {
        throw new BusinessException(ErrorCode.USERNAME_EXISTS)
      }
    }

    const existsEmail = await this.prisma.user.findUnique({
      where: { email: input.email },
    })
    if (existsEmail) {
      if (existsEmail.status === UserStatus.pending_verification) {
        await this.prisma.user.delete({ where: { id: existsEmail.id } })
        this.logger.log(`Deleted stale pending user by email: ${input.email}`)
      } else {
        throw new BusinessException(ErrorCode.EMAIL_EXISTS)
      }
    }

    // 密码强度校验
    if (!this.validatePassword(input.password)) {
      throw new BusinessException(ErrorCode.PASSWORD_TOO_WEAK)
    }

    // 创建用户（直接 active，邮箱验证为可选增强步骤）
    const passwordHash = await HashUtil.hash(input.password)

    const user = await this.prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        passwordHash,
        role: UserRole.user,
        status: UserStatus.active,
      },
    })

    // 发送验证邮件（不阻断注册，失败只记日志）
    const verifyMode = await this.getEmailVerifyMode()
    try {
      if (verifyMode === 'code') {
        await this.sendVerificationCode(user)
      } else {
        await this.sendVerificationLink(user)
      }
    } catch (err) {
      this.logger.warn(`Verification email failed for ${user.email}: ${(err as Error).message}`)
    }

    this.logger.log(`User registered: ${user.username} (${user.email}), verifyMode=${verifyMode}`)

    return {
      code: 0,
      data: { message: '注册成功，请登录' },
      message: 'ok',
    }
  }

  async login(
    username: string,
    password: string,
  ): Promise<{
    accessToken: string
    refreshToken: string
    user: Omit<User, 'passwordHash' | 'emailVerifyToken' | 'passwordResetToken'>
  }> {
    const user = await this.prisma.user.findUnique({
      where: { username },
    })
    if (!user) {
      throw new BusinessException(ErrorCode.PASSWORD_INCORRECT, 401)
    }

    if (user.status === UserStatus.banned) {
      throw new BusinessException(ErrorCode.ACCOUNT_BANNED, 403)
    }
    if (user.status === UserStatus.deleted) {
      throw new BusinessException(ErrorCode.ACCOUNT_DELETED, 403)
    }
    // pending_verification 兼容：自动转 active（邮箱验证变为可选增强步骤）
    if (user.status === UserStatus.pending_verification) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { status: UserStatus.active },
      })
      this.logger.log(`Auto-activated pending user on login: ${user.username}`)
    }

    const valid = await HashUtil.verify(user.passwordHash, password)
    if (!valid) {
      throw new BusinessException(ErrorCode.PASSWORD_INCORRECT, 401)
    }

    const tokens = await this.issueTokens(user)

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const {
      passwordHash: _ph,
      emailVerifyToken: _evt,
      passwordResetToken: _prt,
      ...safeUser
    } = user
    return {
      ...tokens,
      user: safeUser as Omit<User, 'passwordHash' | 'emailVerifyToken' | 'passwordResetToken'>,
    }
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: token },
    })
    if (!user) {
      throw new BusinessException(ErrorCode.EMAIL_VERIFY_TOKEN_INVALID)
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken: null,
        emailVerifiedAt: new Date(),
        status: UserStatus.active,
      },
    })

    this.logger.log(`Email verified: ${user.email}`)
    return { message: '邮箱验证成功' }
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } })
    if (!user) {
      // 不暴露邮箱是否存在
      return { message: '如该邮箱已注册，将收到重置邮件' }
    }

    const token = await HashUtil.randomToken(32)
    const expires = new Date(Date.now() + 30 * 60 * 1000) // 30 分钟

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: token,
        passwordResetExpires: expires,
      },
    })

    await this.mailService.sendPasswordReset(user.email, token, user.username)
    return { message: '如该邮箱已注册，将收到重置邮件' }
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    if (!this.validatePassword(newPassword)) {
      throw new BusinessException(ErrorCode.PASSWORD_TOO_WEAK)
    }

    const user = await this.prisma.user.findFirst({
      where: { passwordResetToken: token },
    })
    if (!user || !user.passwordResetExpires || user.passwordResetExpires < new Date()) {
      throw new BusinessException(ErrorCode.PASSWORD_RESET_TOKEN_INVALID)
    }

    const passwordHash = await HashUtil.hash(newPassword)
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    })

    // 清除所有 Refresh Token
    await this.redis.del(`refresh:${user.id}`)

    this.logger.log(`Password reset: ${user.email}`)
    return { message: '密码重置成功' }
  }

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      })

      // 白名单校验
      const stored = await this.redis.get(`refresh:${payload.sub}`)
      if (stored !== refreshToken) {
        throw new Error('invalid refresh token')
      }

      const user = await this.prisma.user.findUnique({
        where: { id: BigInt(payload.sub) },
      })
      if (!user || user.status !== UserStatus.active) {
        throw new Error('user not active')
      }

      return this.issueTokens(user)
    } catch {
      throw new BusinessException(ErrorCode.TOKEN_INVALID, 401)
    }
  }

  async logout(userId: string): Promise<void> {
    await this.redis.del(`refresh:${userId}`)
  }

  private async issueTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const payload: JwtPayload = {
      sub: user.id.toString(),
      username: user.username,
      role: user.role,
      isPaid: user.isPaid,
    }

    const accessToken = await this.jwtService.signAsync(payload)
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES', '7d'),
    })

    // Refresh Token 白名单（支持多设备：存最新一个；如需多设备共存改用 Set）
    // 这里用 Set 支持多设备
    await this.redis.sadd(`refresh:${user.id}`, refreshToken)
    await this.redis.expire(`refresh:${user.id}`, this.refreshTtl)

    // 记录登录设备信息（用于设备管理）
    const sessionId = createHash('md5').update(refreshToken).digest('hex').slice(0, 12)
    await this.redis.hset(
      `sessions:${user.id}`,
      sessionId,
      JSON.stringify({
        id: sessionId,
        loginAt: new Date().toISOString(),
        // IP 和 UA 由 controller 层传入（这里简化）
        ip: 'unknown',
        ua: 'unknown',
      }),
    )
    await this.redis.expire(`sessions:${user.id}`, this.refreshTtl)

    return { accessToken, refreshToken }
  }

  /**
   * 获取用户登录设备列表
   */
  async getSessions(
    userId: bigint,
  ): Promise<Array<{ id: string; loginAt: string; ip: string; ua: string; current?: boolean }>> {
    const data = await this.redis
      .hgetall(`sessions:${userId}`)
      .catch(() => ({}) as Record<string, string>)
    return Object.entries(data).map(([id, json]) => {
      try {
        return JSON.parse(json) as { id: string; loginAt: string; ip: string; ua: string }
      } catch {
        return { id, loginAt: '', ip: 'unknown', ua: 'unknown' }
      }
    })
  }

  /**
   * 踢出指定登录设备
   */
  async revokeSession(userId: bigint, sessionId: string): Promise<void> {
    await this.redis.hdel(`sessions:${userId}`, sessionId)
    // 注意：无法精确删除对应的 refresh token（Set 中存的是完整 token）
    // 生产环境可改为 Hash 存 token，此处简化
  }

  private validatePassword(password: string): boolean {
    return password.length >= 8 && /[a-zA-Z]/.test(password) && /\d/.test(password)
  }

  // ============ 邮箱验证双模式 ============

  /** 读取验证模式配置（默认 'code'） */
  private async getEmailVerifyMode(): Promise<'code' | 'link'> {
    const config = await this.prisma.config.findUnique({
      where: { key: 'email_verify_mode' },
    })
    return config?.value === 'link' ? 'link' : 'code'
  }

  /** 验证码模式：6 位数字存 Redis + 发邮件 */
  private async sendVerificationCode(user: User): Promise<void> {
    const code = String(randomInt(100000, 999999))
    await this.redis.set(`${EMAIL_VERIFY_CODE_PREFIX}${user.id}`, code, 'EX', EMAIL_VERIFY_CODE_TTL)
    await this.mailService.sendEmailVerificationCode(user.email, code, user.username)
    this.logger.log(`Verification code sent to ${user.email}`)
  }

  /** 链接模式：token 存 DB + 发邮件 */
  private async sendVerificationLink(user: User): Promise<void> {
    const token = await HashUtil.randomToken(32)
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifyToken: token },
    })
    await this.mailService.sendEmailVerification(user.email, token, user.username)
    this.logger.log(`Verification link sent to ${user.email}`)
  }

  /** 验证码校验 */
  async verifyEmailCode(userId: bigint, code: string): Promise<{ message: string }> {
    const key = `${EMAIL_VERIFY_CODE_PREFIX}${userId}`
    const stored = await this.redis.get(key)
    if (!stored || stored !== code) {
      throw new BusinessException(ErrorCode.EMAIL_VERIFY_TOKEN_INVALID)
    }
    await this.redis.del(key)
    await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    })
    this.logger.log(`Email verified via code: userId=${userId}`)
    return { message: '邮箱验证成功' }
  }

  /** 已登录用户重发验证邮件 */
  async resendVerification(userId: bigint): Promise<{ message: string; mode: string }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw new BusinessException(ErrorCode.NOT_FOUND)
    if (user.emailVerifiedAt) return { message: '邮箱已验证', mode: 'none' }

    const mode = await this.getEmailVerifyMode()
    if (mode === 'code') {
      await this.sendVerificationCode(user)
    } else {
      await this.sendVerificationLink(user)
    }
    return { message: '验证邮件已重新发送', mode }
  }

  /** admin 获取/设置验证模式 */
  async getEmailVerifyModePublic(): Promise<{ mode: string }> {
    return { mode: await this.getEmailVerifyMode() }
  }

  async setEmailVerifyMode(mode: 'code' | 'link', adminId: bigint): Promise<{ mode: string }> {
    await this.prisma.config.upsert({
      where: { key: 'email_verify_mode' },
      create: { key: 'email_verify_mode', value: mode },
      update: { value: mode },
    })
    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action: 'set_email_verify_mode',
        targetType: 'config',
        targetId: null,
        detail: { mode },
      },
    })
    this.logger.log(`Email verify mode changed to ${mode} by admin ${adminId}`)
    return { mode }
  }
}
