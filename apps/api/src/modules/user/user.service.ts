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
    },
  ) {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(updates.avatarUrl !== undefined && { avatarUrl: updates.avatarUrl }),
        ...(updates.bio !== undefined && { bio: updates.bio }),
      },
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
}
