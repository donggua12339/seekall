import { Test, TestingModule } from '@nestjs/testing'
import { UserService } from './user.service'
import { PrismaService } from '../../database/prisma.service'
import { ForbiddenException } from '@nestjs/common'

// Mock PrismaService
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  license: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
  },
  config: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  adminAuditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
}

describe('UserService', () => {
  let service: UserService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile()

    service = module.get<UserService>(UserService)
    jest.clearAllMocks()
  })

  describe('getProfile', () => {
    it('返回用户信息(过滤敏感字段)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 1n,
        username: 'testuser',
        email: 'test@test.com',
        passwordHash: 'hashed',
        emailVerifyToken: 'token',
        passwordResetToken: 'token',
        isPaid: false,
        status: 'active',
      })

      const result = await service.getProfile(1n)

      expect(result.username).toBe('testuser')
      expect(result.email).toBe('test@test.com')
      // 敏感字段不应返回
      expect(result).not.toHaveProperty('passwordHash')
      expect(result).not.toHaveProperty('emailVerifyToken')
      expect(result).not.toHaveProperty('passwordResetToken')
    })

    it('用户不存在抛 NotFoundException', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      await expect(service.getProfile(999n)).rejects.toThrow('资源不存在')
    })
  })

  describe('getTransactions', () => {
    it('从 license 聚合交易记录,金额按 tier 推算', async () => {
      mockPrisma.license.findMany.mockResolvedValue([
        {
          id: 1n,
          code: 'SA-TRY-ABC123',
          tier: 'trial',
          status: 'used',
          note: 'wm-order:WM123456',
          usedAt: new Date('2026-07-20T10:00:00Z'),
          createdAt: new Date('2026-07-20T09:00:00Z'),
        },
        {
          id: 2n,
          code: 'SA-MON-DEF456',
          tier: 'monthly',
          status: 'used',
          note: 'wm-order:WM789012',
          usedAt: new Date('2026-07-21T10:00:00Z'),
          createdAt: new Date('2026-07-21T09:00:00Z'),
        },
      ])

      const result = await service.getTransactions(100n)

      expect(result).toHaveLength(2)
      expect(result[0].tier).toBe('trial') // mock 返回顺序
      expect(result[0].amount).toBe(1) // trial = ¥1
      expect(result[1].tier).toBe('monthly')
      expect(result[1].amount).toBe(18) // monthly = ¥18
      expect(result[0].wmOrderId).toBe('WM123456')
    })

    it('无交易记录返回空数组', async () => {
      mockPrisma.license.findMany.mockResolvedValue([])

      const result = await service.getTransactions(100n)

      expect(result).toHaveLength(0)
    })

    it('note 中无 wm-order 时 wmOrderId 为 null', async () => {
      mockPrisma.license.findMany.mockResolvedValue([
        {
          id: 1n,
          code: 'SA-TRY-XYZ',
          tier: 'trial',
          status: 'used',
          note: null,
          usedAt: null,
          createdAt: new Date('2026-07-20T09:00:00Z'),
        },
      ])

      const result = await service.getTransactions(100n)

      expect(result[0].wmOrderId).toBeNull()
    })
  })

  describe('requestReceipt', () => {
    it('license 不属于该用户时抛 NotFoundException', async () => {
      mockPrisma.license.findFirst.mockResolvedValue(null)

      await expect(
        service.requestReceipt(100n, {
          licenseCode: 'SA-TRY-NOT-OWN',
          title: 'Test Receipt',
          email: 'test@test.com',
        }),
      ).rejects.toThrow('资源不存在')
    })

    it('生成收据 ID 格式 SA-RCPT-xxx', async () => {
      mockPrisma.license.findFirst.mockResolvedValue({
        id: 1n,
        code: 'SA-TRY-ABC123',
        tier: 'trial',
        usedAt: new Date('2026-07-20T10:00:00Z'),
        createdAt: new Date('2026-07-20T09:00:00Z'),
      })

      const result = await service.requestReceipt(100n, {
        licenseCode: 'SA-TRY-ABC123',
        title: 'Test Receipt',
        email: 'test@test.com',
      })

      expect(result.receiptId).toMatch(/^SA-RCPT-/)
      expect(result.amount).toBe(1) // trial = ¥1
      expect(result.title).toBe('Test Receipt')
      expect(result.disclaimer).toContain('非税务发票')
    })
  })

  describe('requestRefund', () => {
    it('超过 7 天的 license 不可退款', async () => {
      mockPrisma.license.findFirst.mockResolvedValue({
        id: 1n,
        code: 'SA-TRY-OLD',
        tier: 'trial',
        usedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 天前
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      })

      await expect(
        service.requestRefund(100n, {
          licenseCode: 'SA-TRY-OLD',
          reason: '买错了',
        }),
      ).rejects.toThrow(ForbiddenException)
    })

    it('7 天内的 license 可退款,记录到 audit log', async () => {
      mockPrisma.license.findFirst.mockResolvedValue({
        id: 1n,
        code: 'SA-TRY-RECENT',
        tier: 'trial',
        usedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 天前
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      })
      mockPrisma.adminAuditLog.create.mockResolvedValue({})

      const result = await service.requestRefund(100n, {
        licenseCode: 'SA-TRY-RECENT',
        reason: '买错了',
      })

      expect(result.message).toContain('已提交')
      expect(mockPrisma.adminAuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'refund_request',
          }),
        }),
      )
    })
  })

  describe('getSync / saveSync', () => {
    it('getSync: 无配置返回 null', async () => {
      mockPrisma.config.findUnique.mockResolvedValue(null)

      const result = await service.getSync(100n)

      expect(result).toBeNull()
    })

    it('getSync: 有配置返回解析后的配置', async () => {
      mockPrisma.config.findUnique.mockResolvedValue({
        key: 'user_config:100',
        value: JSON.stringify({
          defaultRules: ['@seekall/rule-arxiv', '@seekall/rule-github'],
          outputFormat: 'json',
        }),
        updatedAt: new Date('2026-07-21T10:00:00Z'),
      })

      const result = await service.getSync(100n)

      expect(result).not.toBeNull()
      expect(result!.defaultRules).toHaveLength(2)
      expect(result!.outputFormat).toBe('json')
    })

    it('saveSync: upsert 到 configs 表', async () => {
      mockPrisma.config.upsert.mockResolvedValue({})

      const result = await service.saveSync(100n, {
        defaultRules: ['@seekall/rule-arxiv'],
        outputFormat: 'text',
      })

      expect(result.message).toContain('已同步')
      expect(mockPrisma.config.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'user_config:100' },
        }),
      )
    })
  })
})
