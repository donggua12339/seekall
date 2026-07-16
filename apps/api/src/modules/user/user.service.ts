import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { BusinessException } from '../../common/filters/http-exception.filter'
import { ErrorCode } from '../../common/constants/error-codes'

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name)

  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: bigint) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { preferences: true },
    })
    if (!user) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404)
    }

    const { passwordHash: _ph, emailVerifyToken: _evt, passwordResetToken: _prt, ...safe } = user
    return safe
  }

  async updateProfile(
    userId: bigint,
    updates: {
      avatarUrl?: string
      bio?: string
      preferences?: {
        theme?: string
        language?: string
        searchPageSize?: number
        safeSearch?: boolean
        preferredCategories?: string[]
        preferredProviders?: string[]
      }
    },
  ) {
    if (updates.preferences) {
      await this.prisma.userPreference.upsert({
        where: { userId },
        create: {
          userId,
          theme: updates.preferences.theme,
          language: updates.preferences.language,
          searchPageSize: updates.preferences.searchPageSize,
          safeSearch: updates.preferences.safeSearch,
          preferredCategories: updates.preferences.preferredCategories,
          preferredProviders: updates.preferences.preferredProviders,
        },
        update: {
          ...(updates.preferences.theme !== undefined && { theme: updates.preferences.theme }),
          ...(updates.preferences.language !== undefined && {
            language: updates.preferences.language,
          }),
          ...(updates.preferences.searchPageSize !== undefined && {
            searchPageSize: updates.preferences.searchPageSize,
          }),
          ...(updates.preferences.safeSearch !== undefined && {
            safeSearch: updates.preferences.safeSearch,
          }),
          ...(updates.preferences.preferredCategories !== undefined && {
            preferredCategories: updates.preferences.preferredCategories,
          }),
          ...(updates.preferences.preferredProviders !== undefined && {
            preferredProviders: updates.preferences.preferredProviders,
          }),
        },
      })
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(updates.avatarUrl !== undefined && { avatarUrl: updates.avatarUrl }),
        ...(updates.bio !== undefined && { bio: updates.bio }),
      },
      include: { preferences: true },
    })

    const { passwordHash: _ph, emailVerifyToken: _evt, passwordResetToken: _prt, ...safe } = updated
    return safe
  }

  async deleteAccount(userId: bigint): Promise<{ message: string }> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        deletedAt: new Date(),
        status: 'deleted' as const,
        // 匿名化
        username: `deleted_${userId}`,
        email: `deleted_${userId}@seekall.local`,
        passwordHash: 'deleted',
        emailVerifyToken: null,
        passwordResetToken: null,
      },
    })
    this.logger.log(`User account deleted: ${userId}`)
    return { message: '账号已注销，30 天后用户名将被释放' }
  }

  async activateMembership(
    userId: bigint,
    code: string,
  ): Promise<{ message: string; paidUntil: Date | null }> {
    const membershipCode = await this.prisma.membershipCode.findUnique({
      where: { code },
    })
    if (!membershipCode) {
      throw new BusinessException(ErrorCode.MEMBERSHIP_CODE_INVALID)
    }
    if (membershipCode.status !== 'unused') {
      throw new BusinessException(ErrorCode.MEMBERSHIP_CODE_USED)
    }
    if (membershipCode.expiresAt && membershipCode.expiresAt < new Date()) {
      throw new BusinessException(ErrorCode.MEMBERSHIP_CODE_EXPIRED)
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404)
    }

    const now = new Date()
    const base = user.paidUntil && user.paidUntil > now ? user.paidUntil : now
    const paidUntil = new Date(base.getTime() + membershipCode.durationDays * 24 * 60 * 60 * 1000)

    await this.prisma.$transaction([
      this.prisma.membershipCode.update({
        where: { id: membershipCode.id },
        data: {
          status: 'used' as const,
          usedById: userId,
          usedAt: now,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          isPaid: true,
          paidUntil,
          badge: 'sponsor',
        },
      }),
    ])

    return { message: '会员激活成功', paidUntil }
  }

  async getSearchHistoryLimit(userId: bigint): Promise<number> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!user) return 50
    return user.isPaid
      ? this.configService.get<number>('USER_SEARCH_HISTORY_PAID', 500)
      : this.configService.get<number>('USER_SEARCH_HISTORY_FREE', 50)
  }

  private configService: { get: <T>(key: string, defaultValue: T) => T } = {
    get: <T>(key: string, defaultValue: T): T => {
      const v = process.env[key]
      if (v === undefined) return defaultValue
      const n = Number(v)
      return (isNaN(n) ? v : n) as unknown as T
    },
  }
}
