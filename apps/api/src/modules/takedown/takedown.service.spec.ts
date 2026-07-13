import { TakedownService } from './takedown.service'
import { BusinessException } from '../../common/filters/http-exception.filter'

describe('TakedownService', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let service: TakedownService
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let redis: any

  beforeEach(() => {
    prisma = {
      isAvailable: jest.fn().mockReturnValue(true),
      takedownRecord: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        findUnique: jest.fn(),
      },
    }
    redis = {
      del: jest.fn(),
      keys: jest.fn().mockResolvedValue([]),
    }
    service = new TakedownService(prisma, redis)
  })

  describe('report', () => {
    it('应该创建举报记录', async () => {
      prisma.takedownRecord.create.mockResolvedValue({ id: 1n })
      const result = await service.report({
        reporterEmail: 'test@example.com',
        resourceUrl: 'https://example.com/resource',
        reason: '侵权',
      })
      expect(prisma.takedownRecord.create).toHaveBeenCalled()
      expect(result).toBeDefined()
    })

    it('空邮箱应抛异常', async () => {
      await expect(
        service.report({
          reporterEmail: '',
          resourceUrl: 'https://example.com',
          reason: '侵权',
        }),
      ).rejects.toThrow(BusinessException)
    })

    it('空 URL 应抛异常', async () => {
      await expect(
        service.report({
          reporterEmail: 'test@example.com',
          resourceUrl: '',
          reason: '侵权',
        }),
      ).rejects.toThrow(BusinessException)
    })
  })

  describe('list', () => {
    it('应返回分页列表', async () => {
      prisma.takedownRecord.findMany.mockResolvedValue([{ id: 1n }])
      prisma.takedownRecord.count.mockResolvedValue(1)
      const result = await service.list(1, 20)
      expect(result.list).toHaveLength(1)
      expect(result.total).toBe(1)
    })
  })

  describe('resolve', () => {
    it('应更新举报状态为 resolved', async () => {
      prisma.takedownRecord.findUnique.mockResolvedValue({ id: 1n, status: 'pending' })
      prisma.takedownRecord.update.mockResolvedValue({})
      await service.resolve(1n, 1n, 'resolved')
      expect(prisma.takedownRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 1n },
          data: expect.objectContaining({ status: 'resolved' }),
        }),
      )
    })

    it('不存在的记录应抛异常', async () => {
      prisma.takedownRecord.findUnique.mockResolvedValue(null)
      await expect(service.resolve(999n, 1n, 'resolved')).rejects.toThrow(BusinessException)
    })
  })
})
