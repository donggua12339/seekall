/**
 * User 流程 E2E 测试
 *
 * 覆盖：获取个人信息 -> 更新偏好 -> 激活会员 -> 注销账号
 */
import { INestApplication } from '@nestjs/common'
import { createTestApp, closeTestApp, createTestUser, createTestInviteCode, cleanDatabase } from './setup'
import { PrismaService } from '../src/database/prisma.service'
import * as argon2 from 'argon2'

describe('User 流程 (E2E)', () => {
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

    // 创建测试用户并登录获取 token
    const passwordHash = await argon2.hash('Password123')
    const user = await prisma.user.create({
      data: {
        username: 'testuser',
        email: 'test@test.com',
        passwordHash,
        status: 'active',
        emailVerifiedAt: new Date(),
      },
    })
    userId = user.id

    await prisma.userPreference.create({
      data: { userId: user.id },
    })

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { username: 'testuser', password: 'Password123' },
    })
    accessToken = JSON.parse(loginRes.body).data.accessToken
  })

  describe('获取个人信息', () => {
    it('应该返回当前用户信息', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/user/profile',
        headers: { authorization: `Bearer ${accessToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.code).toBe(0)
      expect(body.data.username).toBe('testuser')
      expect(body.data.email).toBe('test@test.com')
      expect(body.data.passwordHash).toBeUndefined()
      expect(body.data.preferences).toBeDefined()
    })

    it('未认证应该返回 401', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/user/profile',
      })

      expect(response.statusCode).toBe(401)
    })
  })

  describe('更新偏好', () => {
    it('应该成功更新主题和每页数量', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/v1/user/profile',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: {
          theme: 'dark',
          searchPageSize: 30,
          safeSearch: false,
        },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.code).toBe(0)

      // 验证已更新
      const pref = await prisma.userPreference.findUnique({ where: { userId } })
      expect(pref?.theme).toBe('dark')
      expect(pref?.searchPageSize).toBe(30)
      expect(pref?.safeSearch).toBe(false)
    })
  })

  describe('会员激活', () => {
    it('应该用有效激活码激活会员', async () => {
      const admin = await createTestUser(prisma, {
        username: 'admin',
        role: 'super_admin',
      })

      const code = await prisma.membershipCode.create({
        data: {
          code: 'MEMCODE1234567',
          durationDays: 30,
          createdById: admin.id,
        },
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/user/membership/activate',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { code: 'MEMCODE1234567' },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.code).toBe(0)
      expect(body.data.paidUntil).toBeDefined()

      // 验证用户已激活
      const user = await prisma.user.findUnique({ where: { id: userId } })
      expect(user?.isPaid).toBe(true)
      expect(user?.paidUntil).not.toBeNull()
      expect(user?.badge).toBe('sponsor')

      // 验证激活码已使用
      const updated = await prisma.membershipCode.findUnique({ where: { id: code.id } })
      expect(updated?.status).toBe('used')
      expect(updated?.usedById).toBe(userId)
    })

    it('无效激活码应该返回 20015', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/user/membership/activate',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { code: 'NONEXISTENT' },
      })

      const body = JSON.parse(response.body)
      expect(body.code).toBe(20015)
    })
  })

  describe('注销账号', () => {
    it('应该软删除账号', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/user/account',
        headers: { authorization: `Bearer ${accessToken}` },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.code).toBe(0)

      // 验证账号已软删除
      const user = await prisma.user.findUnique({ where: { id: userId } })
      expect(user?.status).toBe('deleted')
      expect(user?.deletedAt).not.toBeNull()
      expect(user?.username).toBe(`deleted_${userId}`)
    })
  })
})
