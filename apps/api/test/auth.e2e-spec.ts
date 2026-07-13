/**
 * Auth 流程 E2E 测试
 *
 * 覆盖：注册 -> 邮箱验证 -> 登录 -> 刷新 Token -> 修改密码 -> 登出
 *
 * 注意：需要测试数据库环境（DATABASE_URL 指向测试库）
 * CI 中运行：DATABASE_URL=mysql://test:test@localhost:3306/seekall_test pnpm test:e2e
 */
import { INestApplication } from '@nestjs/common'
import { createTestApp, closeTestApp, createTestUser, createTestInviteCode, cleanDatabase } from './setup'
import { PrismaService } from '../src/database/prisma.service'
import * as argon2 from 'argon2'

describe('Auth 流程 (E2E)', () => {
  let app: INestApplication
  let prisma: PrismaService

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
  })

  describe('注册流程', () => {
    it('应该用有效邀请码成功注册', async () => {
      // 先创建一个管理员生成邀请码
      const admin = await createTestUser(prisma, {
        username: 'admin',
        email: 'admin@test.com',
        role: 'super_admin',
      })
      const inviteCode = await createTestInviteCode(prisma, admin.id)

      // 发起注册请求
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          inviteCode,
          username: 'newuser',
          email: 'new@test.com',
          password: 'Password123',
          agreementVersion: '1.0.0',
        },
      })

      expect(response.statusCode).toBe(201)
      const body = JSON.parse(response.body)
      expect(body.code).toBe(0)
      expect(body.message).toContain('注册成功')

      // 验证用户已创建（pending_verification 状态）
      const user = await prisma.user.findUnique({
        where: { username: 'newuser' },
      })
      expect(user).not.toBeNull()
      expect(user?.status).toBe('pending_verification')
      expect(user?.emailVerifyToken).not.toBeNull()

      // 验证邀请码已标记为 used
      const code = await prisma.inviteCode.findUnique({ where: { code: inviteCode } })
      expect(code?.status).toBe('used')
      expect(code?.usedById).toBe(user?.id)
    })

    it('无效邀请码应该返回 20001', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          inviteCode: 'INVALID1',
          username: 'newuser',
          email: 'new@test.com',
          password: 'Password123',
          agreementVersion: '1.0.0',
        },
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.code).toBe(20001)
    })

    it('密码强度不足应该返回 20006', async () => {
      const admin = await createTestUser(prisma, {
        username: 'admin',
        role: 'super_admin',
      })
      const inviteCode = await createTestInviteCode(prisma, admin.id)

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          inviteCode,
          username: 'newuser',
          email: 'new@test.com',
          password: 'weak', // 太短
          agreementVersion: '1.0.0',
        },
      })

      const body = JSON.parse(response.body)
      expect(body.code).toBe(20006)
    })
  })

  describe('邮箱验证流程', () => {
    it('应该用有效 token 完成邮箱验证', async () => {
      const user = await prisma.user.create({
        data: {
          username: 'verifyuser',
          email: 'verify@test.com',
          passwordHash: '$argon2id$test',
          status: 'pending_verification',
          emailVerifyToken: 'valid-token-123',
        },
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-email',
        payload: { token: 'valid-token-123' },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.code).toBe(0)
      expect(body.message).toContain('验证成功')

      const updated = await prisma.user.findUnique({ where: { id: user.id } })
      expect(updated?.status).toBe('active')
      expect(updated?.emailVerifyToken).toBeNull()
      expect(updated?.emailVerifiedAt).not.toBeNull()
    })

    it('无效 token 应该返回 20011', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-email',
        payload: { token: 'nonexistent' },
      })

      const body = JSON.parse(response.body)
      expect(body.code).toBe(20011)
    })
  })

  describe('登录流程', () => {
    it('应该用正确凭据登录成功', async () => {
      const passwordHash = await argon2.hash('Password123')
      await prisma.user.create({
        data: {
          username: 'loginuser',
          email: 'login@test.com',
          passwordHash,
          status: 'active',
          emailVerifiedAt: new Date(),
        },
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: 'loginuser', password: 'Password123' },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.code).toBe(0)
      expect(body.data.accessToken).toBeDefined()
      expect(body.data.refreshToken).toBeDefined()
      expect(body.data.user.username).toBe('loginuser')
    })

    it('错误密码应该返回 20007', async () => {
      const passwordHash = await argon2.hash('Password123')
      await prisma.user.create({
        data: {
          username: 'loginuser',
          email: 'login@test.com',
          passwordHash,
          status: 'active',
          emailVerifiedAt: new Date(),
        },
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: 'loginuser', password: 'WrongPassword' },
      })

      const body = JSON.parse(response.body)
      expect(body.code).toBe(20007)
    })

    it('未验证邮箱用户登录应该返回 20010', async () => {
      const passwordHash = await argon2.hash('Password123')
      await prisma.user.create({
        data: {
          username: 'unverified',
          email: 'unverified@test.com',
          passwordHash,
          status: 'pending_verification',
        },
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: 'unverified', password: 'Password123' },
      })

      const body = JSON.parse(response.body)
      expect(body.code).toBe(20010)
    })

    it('封禁用户登录应该返回 20013', async () => {
      const passwordHash = await argon2.hash('Password123')
      await prisma.user.create({
        data: {
          username: 'banned',
          email: 'banned@test.com',
          passwordHash,
          status: 'banned',
          bannedReason: '违规操作',
          emailVerifiedAt: new Date(),
        },
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: 'banned', password: 'Password123' },
      })

      const body = JSON.parse(response.body)
      expect(body.code).toBe(20013)
    })
  })

  describe('Token 刷新流程', () => {
    it('应该用 Refresh Token 换取新 Token', async () => {
      // 先登录获取 token
      const passwordHash = await argon2.hash('Password123')
      await prisma.user.create({
        data: {
          username: 'refreshuser',
          email: 'refresh@test.com',
          passwordHash,
          status: 'active',
          emailVerifiedAt: new Date(),
        },
      })

      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { username: 'refreshuser', password: 'Password123' },
      })
      const { refreshToken } = JSON.parse(loginRes.body).data

      // 刷新
      const refreshRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        payload: { refreshToken },
      })

      expect(refreshRes.statusCode).toBe(200)
      const body = JSON.parse(refreshRes.body)
      expect(body.code).toBe(0)
      expect(body.data.accessToken).toBeDefined()
      expect(body.data.refreshToken).toBeDefined()
    })
  })

  describe('密码重置流程', () => {
    it('应该用有效 token 重置密码', async () => {
      const oldHash = await argon2.hash('OldPassword123')
      const user = await prisma.user.create({
        data: {
          username: 'resetuser',
          email: 'reset@test.com',
          passwordHash: oldHash,
          status: 'active',
          emailVerifiedAt: new Date(),
          passwordResetToken: 'reset-token-456',
          passwordResetExpires: new Date(Date.now() + 30 * 60 * 1000),
        },
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/password-reset/confirm',
        payload: { token: 'reset-token-456', newPassword: 'NewPassword456' },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.code).toBe(0)

      // 验证密码已更新
      const updated = await prisma.user.findUnique({ where: { id: user.id } })
      expect(updated?.passwordHash).not.toBe(oldHash)
      expect(updated?.passwordResetToken).toBeNull()
    })

    it('过期 token 应该返回 20012', async () => {
      await prisma.user.create({
        data: {
          username: 'expireduser',
          email: 'expired@test.com',
          passwordHash: '$argon2id$test',
          status: 'active',
          emailVerifiedAt: new Date(),
          passwordResetToken: 'expired-token',
          passwordResetExpires: new Date(Date.now() - 1000), // 已过期
        },
      })

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/password-reset/confirm',
        payload: { token: 'expired-token', newPassword: 'NewPassword456' },
      })

      const body = JSON.parse(response.body)
      expect(body.code).toBe(20012)
    })
  })
})
