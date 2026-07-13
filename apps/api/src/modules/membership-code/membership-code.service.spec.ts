import { MembershipCodeService } from './membership-code.service'
import { BusinessException } from '../../common/filters/http-exception.filter'

describe('MembershipCodeService', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let service: MembershipCodeService
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any

  beforeEach(() => {
    prisma = {
      isAvailable: jest.fn().mockReturnValue(true),
      $transaction: jest.fn((arg: unknown) => {
        if (Array.isArray(arg)) return Promise.all(arg as Promise<unknown>[])
        return (arg as (tx: unknown) => Promise<unknown>)(prisma)
      }),
      membershipCode: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    }
    service = new MembershipCodeService(prisma)
  })

  describe('generateBatch', () => {
    it('应批量生成会员激活码', async () => {
      prisma.membershipCode.create.mockResolvedValue({ id: 1n, code: 'TEST1234' })
      const result = await service.generateBatch(3, 30, 1n)
      expect(result).toHaveLength(3)
      expect(prisma.membershipCode.create).toHaveBeenCalledTimes(3)
    })

    it('数量超过 1000 应抛异常', async () => {
      await expect(service.generateBatch(1001, 30, 1n)).rejects.toThrow(BusinessException)
    })

    it('数量小于 1 应抛异常', async () => {
      await expect(service.generateBatch(0, 30, 1n)).rejects.toThrow(BusinessException)
    })

    it('天数小于 1 应抛异常', async () => {
      await expect(service.generateBatch(1, 0, 1n)).rejects.toThrow(BusinessException)
    })
  })

  describe('list', () => {
    it('应返回分页列表', async () => {
      prisma.membershipCode.findMany.mockResolvedValue([{ id: 1n, code: 'TEST' }])
      prisma.membershipCode.count.mockResolvedValue(1)
      const result = await service.list(1, 20)
      expect(result.list).toHaveLength(1)
      expect(result.total).toBe(1)
    })
  })

  describe('disable', () => {
    it('已使用的激活码应抛异常', async () => {
      prisma.membershipCode.findUnique.mockResolvedValue({ id: 1n, status: 'used' })
      await expect(service.disable(1n)).rejects.toThrow(BusinessException)
    })

    it('已禁用的激活码应抛异常', async () => {
      prisma.membershipCode.findUnique.mockResolvedValue({ id: 1n, status: 'disabled' })
      await expect(service.disable(1n)).rejects.toThrow(BusinessException)
    })

    it('未使用的激活码应成功禁用', async () => {
      prisma.membershipCode.findUnique.mockResolvedValue({ id: 1n, status: 'unused' })
      prisma.membershipCode.update.mockResolvedValue({})
      await service.disable(1n)
      expect(prisma.membershipCode.update).toHaveBeenCalledWith({
        where: { id: 1n },
        data: { status: 'disabled' },
      })
    })
  })

  describe('exportUnused', () => {
    it('应返回未使用的激活码列表', async () => {
      prisma.membershipCode.findMany.mockResolvedValue([
        { code: 'CODE1', createdAt: new Date() },
      ])
      const result = await service.exportUnused(1n)
      expect(result).toHaveLength(1)
      expect(result[0].code).toBe('CODE1')
    })
  })
})
