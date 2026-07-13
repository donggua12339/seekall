import { BlockedKeywordService } from './blocked-keyword.service'
import { BusinessException } from '../../common/filters/http-exception.filter'

describe('BlockedKeywordService', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let service: BlockedKeywordService
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let prisma: any

  beforeEach(() => {
    prisma = {
      isAvailable: jest.fn().mockReturnValue(true),
      blockedKeyword: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        delete: jest.fn(),
        findUnique: jest.fn(),
      },
    }
    service = new BlockedKeywordService(prisma)
  })

  describe('add', () => {
    it('应该添加关键词到黑名单', async () => {
      prisma.blockedKeyword.create.mockResolvedValue({ id: 1n, keyword: '测试' })
      const result = await service.add('测试', 'movie', 1n)
      expect(prisma.blockedKeyword.create).toHaveBeenCalledWith({
        data: { keyword: '测试', createdById: 1n, category: 'movie' },
      })
      expect(result).toBeDefined()
    })
  })

  describe('list', () => {
    it('应返回分页列表', async () => {
      prisma.blockedKeyword.findMany.mockResolvedValue([{ id: 1n, keyword: '测试' }])
      prisma.blockedKeyword.count.mockResolvedValue(1)
      const result = await service.list(1, 20)
      expect(result.list).toHaveLength(1)
      expect(result.total).toBe(1)
    })
  })

  describe('delete', () => {
    it('应删除关键词', async () => {
      prisma.blockedKeyword.findUnique.mockResolvedValue({ id: 1n })
      prisma.blockedKeyword.delete.mockResolvedValue({})
      await service.delete(1n)
      expect(prisma.blockedKeyword.delete).toHaveBeenCalledWith({ where: { id: 1n } })
    })

    it('不存在的关键词应抛异常', async () => {
      prisma.blockedKeyword.findUnique.mockResolvedValue(null)
      await expect(service.delete(999n)).rejects.toThrow(BusinessException)
    })
  })
})
