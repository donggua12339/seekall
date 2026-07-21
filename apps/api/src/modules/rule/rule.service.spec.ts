import { Test, TestingModule } from '@nestjs/testing'
import { RuleService } from './rule.service'
import { PrismaService } from '../../database/prisma.service'
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common'
import { RuleRiskLevel, RuleStatus } from '@prisma/client'

// Mock PrismaService
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma: any = {
  rule: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  ruleSubscription: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
  ruleReview: {
    upsert: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  adminAuditLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
}

describe('RuleService', () => {
  let service: RuleService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RuleService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile()

    service = module.get<RuleService>(RuleService)

    // 重置所有 mock
    jest.clearAllMocks()
  })

  describe('subscribe - tier 校验', () => {
    const ruleId = 1n
    const userId = 100n

    it('L0 规则: 任何用户都能订阅(不校验 tier)', async () => {
      mockPrisma.rule.findUnique.mockResolvedValue({
        id: ruleId,
        npmPackage: '@seekall/rule-arxiv',
        riskLevel: RuleRiskLevel.l0,
        status: RuleStatus.published,
      })
      mockPrisma.ruleSubscription.upsert.mockResolvedValue({})

      const result = await service.subscribe(ruleId, userId)

      expect(result.subscribed).toBe(true)
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled()
    })

    it('L2 规则: trial 用户被拒(白嫖漏洞修复)', async () => {
      mockPrisma.rule.findUnique.mockResolvedValue({
        id: ruleId,
        npmPackage: '@seekall/rule-reddit',
        riskLevel: RuleRiskLevel.l2,
        status: RuleStatus.published,
      })
      // trial 用户: isPaid=true 但 tier=trial
      mockPrisma.user.findUnique.mockResolvedValue({
        isPaid: true,
        tier: 'trial',
        paidUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 天后过期
        status: 'active',
      })

      await expect(service.subscribe(ruleId, userId)).rejects.toThrow(ForbiddenException)
      await expect(service.subscribe(ruleId, userId)).rejects.toThrow(/月度.*会员.*当前档位.*trial/)
    })

    it('L2 规则: monthly 用户可订阅', async () => {
      mockPrisma.rule.findUnique.mockResolvedValue({
        id: ruleId,
        npmPackage: '@seekall/rule-reddit',
        riskLevel: RuleRiskLevel.l2,
        status: RuleStatus.published,
      })
      mockPrisma.user.findUnique.mockResolvedValue({
        isPaid: true,
        tier: 'monthly',
        paidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'active',
      })
      mockPrisma.ruleSubscription.upsert.mockResolvedValue({})

      const result = await service.subscribe(ruleId, userId)

      expect(result.subscribed).toBe(true)
    })

    it('L2 规则: lifetime 用户可订阅', async () => {
      mockPrisma.rule.findUnique.mockResolvedValue({
        id: ruleId,
        npmPackage: '@seekall/rule-reddit',
        riskLevel: RuleRiskLevel.l2,
        status: RuleStatus.published,
      })
      mockPrisma.user.findUnique.mockResolvedValue({
        isPaid: true,
        tier: 'lifetime',
        paidUntil: new Date(Date.now() + 36500 * 24 * 60 * 60 * 1000),
        status: 'active',
      })
      mockPrisma.ruleSubscription.upsert.mockResolvedValue({})

      const result = await service.subscribe(ruleId, userId)

      expect(result.subscribed).toBe(true)
    })

    it('L2 规则: paidUntil 过期的 monthly 用户被拒', async () => {
      mockPrisma.rule.findUnique.mockResolvedValue({
        id: ruleId,
        npmPackage: '@seekall/rule-reddit',
        riskLevel: RuleRiskLevel.l2,
        status: RuleStatus.published,
      })
      // isPaid=true 但 paidUntil 已过期(缓存失效场景)
      mockPrisma.user.findUnique.mockResolvedValue({
        isPaid: true,
        tier: 'monthly',
        paidUntil: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 天前过期
        status: 'active',
      })

      await expect(service.subscribe(ruleId, userId)).rejects.toThrow(ForbiddenException)
      await expect(service.subscribe(ruleId, userId)).rejects.toThrow(/会员已过期/)
    })

    it('L2 规则: isPaid=false 的免费用户被拒', async () => {
      mockPrisma.rule.findUnique.mockResolvedValue({
        id: ruleId,
        npmPackage: '@seekall/rule-reddit',
        riskLevel: RuleRiskLevel.l2,
        status: RuleStatus.published,
      })
      mockPrisma.user.findUnique.mockResolvedValue({
        isPaid: false,
        tier: null,
        paidUntil: null,
        status: 'active',
      })

      await expect(service.subscribe(ruleId, userId)).rejects.toThrow(ForbiddenException)
    })

    it('L3 规则: 永远不可订阅', async () => {
      mockPrisma.rule.findUnique.mockResolvedValue({
        id: ruleId,
        npmPackage: '@seekall/rule-mystery',
        riskLevel: RuleRiskLevel.l3,
        status: RuleStatus.published,
      })

      await expect(service.subscribe(ruleId, userId)).rejects.toThrow(ForbiddenException)
      await expect(service.subscribe(ruleId, userId)).rejects.toThrow(/L3.*不可订阅/)
    })

    it('L4 规则: 永远不可订阅', async () => {
      mockPrisma.rule.findUnique.mockResolvedValue({
        id: ruleId,
        npmPackage: '@seekall/rule-pirate',
        riskLevel: RuleRiskLevel.l4,
        status: RuleStatus.published,
      })

      await expect(service.subscribe(ruleId, userId)).rejects.toThrow(ForbiddenException)
    })

    it('未发布的规则不可订阅', async () => {
      mockPrisma.rule.findUnique.mockResolvedValue({
        id: ruleId,
        npmPackage: '@seekall/rule-pending',
        riskLevel: RuleRiskLevel.l0,
        status: RuleStatus.pending_review,
      })

      await expect(service.subscribe(ruleId, userId)).rejects.toThrow(BadRequestException)
    })

    it('不存在的规则抛 NotFoundException', async () => {
      mockPrisma.rule.findUnique.mockResolvedValue(null)

      await expect(service.subscribe(ruleId, userId)).rejects.toThrow(NotFoundException)
    })
  })

  describe('subscribe - 幂等', () => {
    it('已订阅的规则再次订阅不报错(upsert 幂等)', async () => {
      mockPrisma.rule.findUnique.mockResolvedValue({
        id: 1n,
        npmPackage: '@seekall/rule-arxiv',
        riskLevel: RuleRiskLevel.l0,
        status: RuleStatus.published,
      })
      mockPrisma.ruleSubscription.upsert.mockResolvedValue({})

      const result1 = await service.subscribe(1n, 100n)
      const result2 = await service.subscribe(1n, 100n)

      expect(result1.subscribed).toBe(true)
      expect(result2.subscribed).toBe(true)
      expect(mockPrisma.ruleSubscription.upsert).toHaveBeenCalledTimes(2)
    })
  })
})
