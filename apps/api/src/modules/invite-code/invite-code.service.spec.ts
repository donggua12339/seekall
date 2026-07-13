import { InviteCodeService } from './invite-code.service'
import { PrismaService } from '../../database/prisma.service'
import { BusinessException } from '../../common/filters/http-exception.filter'

describe('InviteCodeService', () => {
  let service: InviteCodeService
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any

  beforeEach(() => {
    prisma = {
      isAvailable: jest.fn().mockReturnValue(true),
      $transaction: jest.fn((arg: unknown) => {
        if (Array.isArray(arg)) return Promise.all(arg as Promise<unknown>[])
        return (arg as (tx: unknown) => Promise<unknown>)(prisma)
      }),
      inviteCode: {
        create: jest.fn(),
        createMany: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    }

    service = new InviteCodeService(prisma as unknown as PrismaService)
  })

  describe('generateBatch', () => {
    it('应批量生成邀请码', async () => {
      prisma.inviteCode.create.mockResolvedValue({ id: 1n, code: 'TEST1234' } as never)
      const result = await service.generateBatch(3, 1n)
      expect(result).toHaveLength(3)
      expect(prisma.inviteCode.create).toHaveBeenCalledTimes(3)
    })

    it('数量超过 1000 应抛异常', async () => {
      await expect(service.generateBatch(1001, 1n)).rejects.toThrow(BusinessException)
    })

    it('数量小于 1 应抛异常', async () => {
      await expect(service.generateBatch(0, 1n)).rejects.toThrow(BusinessException)
    })
  })

  describe('list', () => {
    it('应返回分页列表', async () => {
      prisma.inviteCode.findMany.mockResolvedValue([{ id: 1n, code: 'TEST' }] as never)
      prisma.inviteCode.count.mockResolvedValue(1 as never)
      const result = await service.list(1, 20)
      expect(result.list).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('带状态过滤应传递参数', async () => {
      prisma.inviteCode.findMany.mockResolvedValue([] as never)
      prisma.inviteCode.count.mockResolvedValue(0 as never)
      await service.list(1, 20, 'unused')
      expect(prisma.inviteCode.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'unused' }),
        }),
      )
    })
  })

  describe('disable', () => {
    it('邀请码不存在应抛异常', async () => {
      prisma.inviteCode.findUnique.mockResolvedValue(null as never)
      await expect(service.disable(999n)).rejects.toThrow(BusinessException)
    })

    it('已禁用的邀请码应抛异常', async () => {
      prisma.inviteCode.findUnique.mockResolvedValue({
        id: 1n,
        status: 'disabled',
      } as never)
      await expect(service.disable(1n)).rejects.toThrow(BusinessException)
    })

    it('未禁用的邀请码应成功禁用', async () => {
      prisma.inviteCode.findUnique.mockResolvedValue({
        id: 1n,
        status: 'unused',
      } as never)
      prisma.inviteCode.update.mockResolvedValue({ id: 1n, status: 'disabled' } as never)
      await service.disable(1n)
      expect(prisma.inviteCode.update).toHaveBeenCalledWith({
        where: { id: 1n },
        data: { status: 'disabled' },
      })
    })
  })

  describe('exportUnused', () => {
    it('应返回未使用的邀请码列表', async () => {
      prisma.inviteCode.findMany.mockResolvedValue([
        { code: 'CODE1', createdAt: new Date() },
        { code: 'CODE2', createdAt: new Date() },
      ] as never)
      const result = await service.exportUnused(1n)
      expect(result).toHaveLength(2)
      expect(result[0].code).toBe('CODE1')
    })
  })
})
