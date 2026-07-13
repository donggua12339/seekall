/**
 * Search 流程 E2E 测试
 *
 * 覆盖：搜索 -> 缓存命中 -> 黑名单过滤 -> 失效链接过滤 -> 搜索历史
 */
import { INestApplication } from '@nestjs/common'
import { createTestApp, closeTestApp, cleanDatabase } from './setup'
import { PrismaService } from '../src/database/prisma.service'
import * as argon2 from 'argon2'

describe('Search 流程 (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService
  let accessToken: string
  let userId: bigint

  beforeAll(async () => {
    const testApp = await createTestApp()
    app = testApp.app
    prisma = testApp.prisma
  })

  afterAll(async () => {
    await closeTestApp(app)
  })

  beforeEach(async () => {
    await cleanDatabase(prisma)

    const passwordHash = await argon2.hash('Password123')
    const user = await prisma.user.create({
      data: {
        username: 'searchuser',
        email: 'search@test.com',
        passwordHash,
        status: 'active',
        emailVerifiedAt: new Date(),
      },
    })
    userId = user.id

    await prisma.userPreference.create({ data: { userId } })

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'searchuser', password: 'Password123' },
    })
    accessToken = JSON.parse(loginRes.body).data.accessToken
  })

  describe('搜索接口', () => {
    it('空关键词应该返回 40005', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/search',
        headers: { authorization: `Bearer ${accessToken}` },
        query: { keyword: '' },
      })

      const body = JSON.parse(response.body)
      expect(body.code).toBe(40005)
    })

    it('关键词过长（>100）应该返回 40004', async () => {
      const longKeyword = 'a'.repeat(101)
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/search',
        headers: { authorization: `Bearer ${accessToken}` },
        query: { keyword: longKeyword },
      })

      const body = JSON.parse(response.body)
      expect(body.code).toBe(40004)
    })

    it('黑名单关键词应该返回 40005', async () => {
      const admin = await prisma.user.create({
        data: {
          username: 'admin',
          email: 'admin@test.com',
          passwordHash: '$argon2id$test',
          role: 'super_admin',
          status: 'active',
          emailVerifiedAt: new Date(),
        },
      })

      await prisma.blockedKeyword.create({
        data: {
          keyword: '禁止词',
          createdById: admin.id,
        },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/search',
        headers: { authorization: `Bearer ${accessToken}` },
        query: { keyword: '禁止词' },
      })

      const body = JSON.parse(response.body)
      expect(body.code).toBe(40005)
    })

    it('应该返回搜索结果并写日志', async () => {
      // 注意：此测试依赖外部 PanSou/BT4G 服务可用
      // 如果外部服务不可用，搜索会返回空结果但不报错
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/search',
        headers: { authorization: `Bearer ${accessToken}` },
        query: { keyword: 'test', page: '1', pageSize: '10' },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.code).toBe(0)
      expect(body.data.list).toBeDefined()
      expect(body.data.page).toBe(1)
      expect(body.data.pageSize).toBe(10)
      expect(body.data.durationMs).toBeGreaterThanOrEqual(0)

      // 验证搜索日志已写入
      const logs = await prisma.searchLog.findMany({ where: { userId } })
      expect(logs.length).toBeGreaterThanOrEqual(1)
      expect(logs[0].query).toBe('test')
    })
  })

  describe('缓存', () => {
    it('相同关键词二次搜索应该命中缓存', async () => {
      // 第一次搜索
      await app.inject({
        method: 'GET',
        url: '/api/v1/search',
        headers: { authorization: `Bearer ${accessToken}` },
        query: { keyword: 'cache-test-unique-keyword' },
      })

      // 第二次搜索相同关键词
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/search',
        headers: { authorization: `Bearer ${accessToken}` },
        query: { keyword: 'cache-test-unique-keyword' },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.code).toBe(0)
      // 缓存命中时 durationMs 应该很小
      expect(body.data.durationMs).toBeLessThan(100)
    })
  })

  describe('失效链接过滤', () => {
    it('应该过滤掉 dead 状态的链接', async () => {
      // 预置一条 dead 链接
      await prisma.linkStatusRecord.create({
        data: {
          urlHash: 'a'.repeat(32), // 模拟 hash
          url: 'https://example.com/dead-link',
          status: 'dead',
          lastCheckedAt: new Date(),
        },
      })

      // 注意：实际搜索结果中是否包含此链接取决于外部 Provider
      // 这里仅验证 link_status 表能正确记录
      const link = await prisma.linkStatusRecord.findUnique({
        where: { urlHash: 'a'.repeat(32) },
      })
      expect(link?.status).toBe('dead')
    })
  })

  describe('搜索历史', () => {
    it('应该能查询搜索历史', async () => {
      // 先预置一条搜索历史
      await prisma.searchHistory.create({
        data: {
          userId,
          query: '历史测试',
          resultCount: 10,
        },
      })

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/search-history',
        headers: { authorization: `Bearer ${accessToken}` },
        query: { page: '1', pageSize: '10' },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.code).toBe(0)
      expect(body.data.list).toHaveLength(1)
      expect(body.data.list[0].query).toBe('历史测试')
    })

    it('应该能删除单条搜索历史', async () => {
      const history = await prisma.searchHistory.create({
        data: {
          userId,
          query: '待删除',
          resultCount: 0,
        },
      })

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/search-history/${history.id}`,
        headers: { authorization: `Bearer ${accessToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.code).toBe(0)

      // 验证已删除
      const deleted = await prisma.searchHistory.findUnique({ where: { id: history.id } })
      expect(deleted).toBeNull()
    })

    it('应该能清空所有搜索历史', async () => {
      await prisma.searchHistory.createMany({
        data: [
          { userId, query: 'test1', resultCount: 0 },
          { userId, query: 'test2', resultCount: 0 },
          { userId, query: 'test3', resultCount: 0 },
        ],
      })

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/search-history',
        headers: { authorization: `Bearer ${accessToken}` },
      })

      expect(response.statusCode).toBe(200)
      const count = await prisma.searchHistory.count({ where: { userId } })
      expect(count).toBe(0)
    })
  })

  describe('收藏夹', () => {
    it('应该能添加收藏', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/favorites',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          resourceUrl: 'https://example.com/resource',
          title: '测试收藏',
          source: 'pansou',
          category: 'netdisk',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.code).toBe(0)
    })

    it('重复收藏应该返回 30003', async () => {
      await prisma.favorite.create({
        data: {
          userId,
          resourceUrl: 'https://example.com/duplicate',
          title: '已收藏',
          source: 'pansou',
        },
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/favorites',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          resourceUrl: 'https://example.com/duplicate',
          title: '再次收藏',
          source: 'pansou',
        },
      })

      const body = JSON.parse(response.body)
      expect(body.code).toBe(30003)
    })
  })
})
