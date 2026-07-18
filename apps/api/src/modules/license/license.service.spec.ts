import { Test, TestingModule } from '@nestjs/testing'
import { LicenseService } from './license.service'
import { PrismaService } from '../../database/prisma.service'
import { ConfigService } from '@nestjs/config'
import { UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common'
import { createHmac } from 'crypto'

// Mock PrismaService - 用 any 避免 $transaction 自引用类型推导问题
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  license: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  licenseClaim: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((cb: (tx: unknown) => unknown) => cb(mockPrisma)),
}

// Mock ConfigService
const mockConfigService = {
  get: jest.fn((key: string, defaultValue?: unknown) => {
    if (key === 'WM_WEBHOOK_SECRET') return 'test-webhook-secret'
    return defaultValue
  }),
}

describe('LicenseService', () => {
  let service: LicenseService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LicenseService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile()

    service = module.get<LicenseService>(LicenseService)
    jest.clearAllMocks()
  })

  describe('generateCode', () => {
    it('应生成 trial 类型 license code', async () => {
      const mockLicense = {
        id: BigInt(1),
        code: 'SA-TRY-ABCD1234EFGH5678',
        tier: 'trial',
        status: 'unused',
        generatedBy: BigInt(1),
      }
      mockPrisma.license.create.mockResolvedValue(mockLicense)

      const result = await service.generateCode({
        tier: 'trial',
        generatedBy: BigInt(1),
      })

      expect(result).toEqual(mockLicense)
      expect(mockPrisma.license.create).toHaveBeenCalledWith({
        data: {
          code: expect.stringMatching(/^SA-TRY-[A-F0-9]{16}$/),
          tier: 'trial',
          status: 'unused',
          generatedBy: BigInt(1),
          note: undefined,
        },
      })
    })

    it('应生成 monthly 类型 license code', async () => {
      mockPrisma.license.create.mockImplementation((args: { data: { code: string } }) =>
        Promise.resolve({
          id: BigInt(2),
          code: args.data.code,
          tier: 'monthly',
        }),
      )
      const result = await service.generateCode({
        tier: 'monthly',
        generatedBy: BigInt(2),
        note: 'test-note',
      })

      expect(result.code).toMatch(/^SA-MON-[A-F0-9]{16}$/)
    })

    it('应生成 lifetime 类型 license code', async () => {
      mockPrisma.license.create.mockImplementation((args: { data: { code: string } }) =>
        Promise.resolve({
          id: BigInt(3),
          code: args.data.code,
          tier: 'lifetime',
        }),
      )
      const result = await service.generateCode({
        tier: 'lifetime',
        generatedBy: BigInt(3),
      })

      expect(result.code).toMatch(/^SA-LIF-[A-F0-9]{16}$/)
    })
  })

  describe('generateInviteTrialCode', () => {
    it('本月用量 < 3 应成功生成', async () => {
      mockPrisma.license.count.mockResolvedValue(2)
      mockPrisma.license.create.mockResolvedValue({
        id: BigInt(10),
        code: 'SA-TRY-XXXXXXXXXXXXXXXX',
        tier: 'trial',
      })

      const result = await service.generateInviteTrialCode(BigInt(1))

      expect(result.code).toMatch(/^SA-TRY-/)
      expect(mockPrisma.license.count).toHaveBeenCalled()
    })

    it('本月用量 >= 3 应抛 ForbiddenException', async () => {
      mockPrisma.license.count.mockResolvedValue(3)

      await expect(service.generateInviteTrialCode(BigInt(1))).rejects.toThrow('本月邀请码已用完')
    })
  })

  describe('redeem', () => {
    it('code 不存在应抛 NotFoundException', async () => {
      mockPrisma.license.findUnique.mockResolvedValue(null)

      await expect(service.redeem('SA-TRY-XXXX', BigInt(1))).rejects.toThrow(NotFoundException)
    })

    it('code 已使用应抛 BadRequestException', async () => {
      mockPrisma.license.findUnique.mockResolvedValue({
        id: BigInt(1),
        code: 'SA-TRY-XXXX',
        tier: 'trial',
        status: 'used',
      })

      await expect(service.redeem('SA-TRY-XXXX', BigInt(1))).rejects.toThrow(BadRequestException)
    })

    it('trial 每账号限领 1 次，已领过应抛 BadRequestException', async () => {
      mockPrisma.license.findUnique.mockResolvedValue({
        id: BigInt(1),
        code: 'SA-TRY-XXXX',
        tier: 'trial',
        status: 'unused',
      })
      mockPrisma.user.findUnique.mockResolvedValue({ id: BigInt(1), isPaid: false })
      mockPrisma.licenseClaim.findFirst.mockResolvedValue({ id: BigInt(1) })

      await expect(service.redeem('SA-TRY-XXXX', BigInt(1))).rejects.toThrow(BadRequestException)
    })

    it('trial 首次兑换应成功，paidUntil 为 7 天后', async () => {
      const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      mockPrisma.license.findUnique.mockResolvedValue({
        id: BigInt(1),
        code: 'SA-TRY-XXXX',
        tier: 'trial',
        status: 'unused',
      })
      mockPrisma.user.findUnique.mockResolvedValue({ id: BigInt(1), isPaid: false })
      mockPrisma.licenseClaim.findFirst.mockResolvedValue(null)
      mockPrisma.license.update.mockResolvedValue({})
      mockPrisma.licenseClaim.create.mockResolvedValue({})
      mockPrisma.user.update.mockResolvedValue({
        id: BigInt(1),
        isPaid: true,
        paidUntil: sevenDaysLater,
      })

      const beforeTime = Date.now()
      const result = await service.redeem('SA-TRY-XXXX', BigInt(1))
      const afterTime = Date.now()

      expect(result.isPaid).toBe(true)
      // paidUntil 应在 7 天前后(给 1 分钟容差)
      const paidUntilMs = new Date(result.paidUntil as Date).getTime()
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
      expect(paidUntilMs).toBeGreaterThan(beforeTime + sevenDaysMs - 60000)
      expect(paidUntilMs).toBeLessThan(afterTime + sevenDaysMs + 60000)
    })

    it('monthly 兑换应 paidUntil 为 30 天后', async () => {
      const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      mockPrisma.license.findUnique.mockResolvedValue({
        id: BigInt(1),
        code: 'SA-MON-XXXX',
        tier: 'monthly',
        status: 'unused',
      })
      mockPrisma.user.findUnique.mockResolvedValue({ id: BigInt(1), isPaid: false })
      mockPrisma.license.update.mockResolvedValue({})
      mockPrisma.licenseClaim.create.mockResolvedValue({})
      mockPrisma.user.update.mockResolvedValue({
        id: BigInt(1),
        isPaid: true,
        paidUntil: thirtyDaysLater,
      })

      const result = await service.redeem('SA-MON-XXXX', BigInt(1))
      const paidUntilMs = new Date(result.paidUntil as Date).getTime()
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000
      const nowMs = Date.now()
      expect(paidUntilMs).toBeGreaterThan(nowMs + thirtyDaysMs - 60000)
      expect(paidUntilMs).toBeLessThan(nowMs + thirtyDaysMs + 60000)
    })
  })

  describe('handleWmWebhook', () => {
    const validSecret = 'test-webhook-secret'
    const wmOrderId = 'WM-ORDER-12345'
    const tier = 'monthly'
    const amount = 18

    function sign(secret: string): string {
      return createHmac('sha256', secret).update(`${wmOrderId}|${tier}|${amount}`).digest('hex')
    }

    it('正确签名应成功生成 license', async () => {
      mockPrisma.license.findFirst.mockResolvedValue(null) // 无幂等冲突
      mockPrisma.license.create.mockResolvedValue({
        id: BigInt(1),
        code: 'SA-MON-XXXXXXXXXXXXXXXX',
        tier: 'monthly',
        note: `wm-order:${wmOrderId}`,
      })

      const result = await service.handleWmWebhook({
        wmOrderId,
        tier: tier as 'monthly',
        amount,
        signature: sign(validSecret),
      })

      expect(result.note).toBe(`wm-order:${wmOrderId}`)
      expect(mockPrisma.license.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tier: 'monthly',
          note: `wm-order:${wmOrderId}`,
        }),
      })
    })

    it('错误签名应抛 UnauthorizedException', async () => {
      await expect(
        service.handleWmWebhook({
          wmOrderId,
          tier: tier as 'monthly',
          amount,
          signature: 'invalid-signature',
        }),
      ).rejects.toThrow(UnauthorizedException)
    })

    it('同 wmOrderId 已处理过应返回已存在的 license（幂等）', async () => {
      const existingLicense = {
        id: BigInt(99),
        code: 'SA-MON-EXISTINGXXXXXXXX',
        tier: 'monthly',
        note: `wm-order:${wmOrderId}`,
      }
      mockPrisma.license.findFirst.mockResolvedValue(existingLicense)

      const result = await service.handleWmWebhook({
        wmOrderId,
        tier: tier as 'monthly',
        amount,
        signature: sign(validSecret),
      })

      expect(result).toEqual(existingLicense)
      expect(mockPrisma.license.create).not.toHaveBeenCalled()
    })
  })

  describe('disable', () => {
    it('license 不存在应抛 NotFoundException', async () => {
      mockPrisma.license.findUnique.mockResolvedValue(null)

      await expect(service.disable(BigInt(1))).rejects.toThrow(NotFoundException)
    })

    it('已使用的 license 不能禁用，应抛 BadRequestException', async () => {
      mockPrisma.license.findUnique.mockResolvedValue({
        id: BigInt(1),
        status: 'used',
      })

      await expect(service.disable(BigInt(1))).rejects.toThrow(BadRequestException)
    })

    it('unused license 应成功禁用', async () => {
      mockPrisma.license.findUnique.mockResolvedValue({
        id: BigInt(1),
        status: 'unused',
      })
      mockPrisma.license.update.mockResolvedValue({
        id: BigInt(1),
        status: 'disabled',
      })

      const result = await service.disable(BigInt(1))
      expect(result.status).toBe('disabled')
    })
  })
})
