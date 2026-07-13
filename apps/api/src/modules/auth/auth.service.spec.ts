import { AuthService } from './auth.service'
import { BusinessException } from '../../common/filters/http-exception.filter'

describe('AuthService', () => {
  let service: AuthService
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let redis: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let jwtService: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let configService: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mailService: any

  beforeEach(() => {
    prisma = {
      isAvailable: () => true,
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      inviteCode: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      agreement: { findUnique: jest.fn() },
      userAgreement: { create: jest.fn() },
    }
    redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      del: jest.fn(),
      sadd: jest.fn(),
      srem: jest.fn(),
      smembers: jest.fn().mockResolvedValue([]),
      expire: jest.fn(),
      multi: jest.fn().mockReturnValue({
        zincrby: jest.fn(),
        expire: jest.fn(),
        exec: jest.fn().mockResolvedValue([]),
      }),
    }
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('mock-token'),
      verifyAsync: jest.fn(),
    }
    configService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'refresh-secret'
        if (key === 'JWT_REFRESH_EXPIRES') return '7d'
        return undefined
      }),
    }
    mailService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new AuthService(prisma, jwtService, configService, mailService, redis)
  })

  describe('register', () => {
    it('邀请码无效时应抛异常', async () => {
      prisma.inviteCode.findUnique.mockResolvedValue(null)
      await expect(
        service.register({
          inviteCode: 'INVALID',
          username: 'test',
          email: 'test@test.com',
          password: 'Test1234',
          agreementVersion: '1.0.0',
        }),
      ).rejects.toThrow(BusinessException)
    })

    it('邀请码已使用应抛异常', async () => {
      prisma.inviteCode.findUnique.mockResolvedValue({
        id: 1n,
        code: 'VALID1',
        status: 'used',
        createdById: 1n,
      })
      await expect(
        service.register({
          inviteCode: 'VALID1',
          username: 'test',
          email: 'test@test.com',
          password: 'Test1234',
          agreementVersion: '1.0.0',
        }),
      ).rejects.toThrow(BusinessException)
    })

    it('密码强度不足应抛异常', async () => {
      prisma.inviteCode.findUnique.mockResolvedValue({
        id: 1n,
        code: 'VALID1',
        status: 'unused',
        createdById: 1n,
      })
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.agreement.findUnique.mockResolvedValue({ version: '1.0.0' })
      await expect(
        service.register({
          inviteCode: 'VALID1',
          username: 'test',
          email: 'test@test.com',
          password: 'weak',
          agreementVersion: '1.0.0',
        }),
      ).rejects.toThrow(BusinessException)
    })
  })

  describe('githubAuth', () => {
    it('未绑定 GitHub 的用户应返回 register action', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      const result = await service.githubAuth({
        id: '12345',
        username: 'githubuser',
        emails: [{ value: 'test@github.com', verified: true }],
      })
      expect(result.action).toBe('register')
      expect(result.githubProfile?.id).toBe('12345')
    })

    it('已绑定的活跃用户应返回 login action 和 tokens', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 1n,
        username: 'test',
        status: 'active',
        role: 'user',
        isPaid: false,
      })
      prisma.user.update.mockResolvedValue({})
      const result = await service.githubAuth({
        id: '12345',
        username: 'githubuser',
      })
      expect(result.action).toBe('login')
      expect(result.tokens?.accessToken).toBe('mock-token')
    })

    it('数据库不可用应抛异常', async () => {
      prisma.isAvailable = () => false
      await expect(
        service.githubAuth({ id: '12345', username: 'test' }),
      ).rejects.toThrow(BusinessException)
    })
  })

  describe('bindGithub', () => {
    it('GitHub 已被其他用户绑定应抛异常', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 2n, username: 'other' })
      await expect(
        service.bindGithub(1n, { id: '12345', username: 'test' }),
      ).rejects.toThrow(BusinessException)
    })

    it('未绑定时应成功绑定', async () => {
      prisma.user.findUnique.mockResolvedValue(null)
      prisma.user.update.mockResolvedValue({})
      const result = await service.bindGithub(1n, { id: '12345', username: 'test' })
      expect(result.message).toContain('成功')
    })
  })

  describe('unbindGithub', () => {
    it('应成功解绑', async () => {
      prisma.user.update.mockResolvedValue({})
      const result = await service.unbindGithub(1n)
      expect(result.message).toContain('解绑')
    })
  })
})
