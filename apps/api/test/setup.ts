/**
 * 觅源 SeekAll - E2E 测试启动辅助
 *
 * 使用 SQLite in-memory 作为测试数据库，避免依赖真实 MySQL。
 * Prisma 支持 SQLite，schema 通过 prisma test schema 生成。
 */
import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { PrismaService } from '../src/database/prisma.service'
import { AppModule } from '../src/app.module'

export interface TestApp {
  app: INestApplication
  prisma: PrismaService
}

/**
 * 创建测试应用实例
 * 注意：此函数需要测试数据库环境（SQLite 或 MySQL test 库）
 * CI 中通过 DATABASE_URL 环境变量指向测试库
 */
export async function createTestApp(): Promise<TestApp> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  const app = moduleFixture.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false }),
  )

  app.setGlobalPrefix('api/v1', { exclude: ['/health'] })
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  await app.init()
  await app.getHttpAdapter().getInstance().ready()

  const prisma = app.get(PrismaService)

  // 清理测试数据（按依赖顺序）
  await cleanDatabase(prisma)

  return { app, prisma }
}

export async function cleanDatabase(prisma: PrismaService): Promise<void> {
  const tables = [
    'user_agreements',
    'admin_audit_logs',
    'blocked_keywords',
    'takedown_records',
    'favorites',
    'search_logs',
    'search_history',
    'link_status',
    'membership_codes',
    'invite_codes',
    'user_preferences',
    'agreements',
    'users',
  ]

  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`DELETE FROM \`${table}\``)
    } catch {
      // 表可能不存在，跳过
    }
  }
}

export async function closeTestApp(app: INestApplication): Promise<void> {
  await app.close()
}

/**
 * 创建测试用户并返回 user id
 */
export async function createTestUser(
  prisma: PrismaService,
  options: {
    username?: string
    email?: string
    passwordHash?: string
    role?: 'super_admin' | 'user'
    status?: 'pending_verification' | 'active' | 'banned' | 'deleted'
    isPaid?: boolean
  } = {},
): Promise<{ id: bigint; username: string; email: string }> {
  const suffix = Math.floor(Math.random() * 1000000)
  const user = await prisma.user.create({
    data: {
      username: options.username || `testuser_${suffix}`,
      email: options.email || `test_${suffix}@example.com`,
      passwordHash: options.passwordHash || '$argon2id$v=19$m=65536,t=3,p=4$test',
      role: options.role || 'user',
      status: options.status || 'active',
      isPaid: options.isPaid || false,
      emailVerifiedAt: options.status === 'active' ? new Date() : null,
    },
  })

  await prisma.userPreference.create({
    data: { userId: user.id },
  })

  return { id: user.id, username: user.username, email: user.email }
}

/**
 * 生成测试邀请码
 */
export async function createTestInviteCode(
  prisma: PrismaService,
  createdById: bigint,
): Promise<string> {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }

  await prisma.inviteCode.create({
    data: {
      code,
      createdById,
    },
  })

  return code
}
