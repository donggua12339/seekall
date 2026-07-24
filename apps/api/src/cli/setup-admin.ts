/**
 * 觅源 SeekAll - 超级管理员初始化脚本
 * 首次部署时运行：pnpm --filter api cli:setup-admin
 *
 * 用法：
 *   ts-node src/cli/setup-admin.ts <username> <email> <password>
 *
 * 示例：
 *   ts-node src/cli/setup-admin.ts admin admin@example.com YourStr0ngP@ss
 */
import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module'
import { PrismaService } from '../database/prisma.service'
import { HashUtil } from '../common/utils/hash.util'
import { Logger } from '@nestjs/common'
import { UserRole, UserStatus } from '@prisma/client'

async function bootstrap() {
  const logger = new Logger('SetupAdmin')
  const [username, email, password] = process.argv.slice(2)

  if (!username || !email || !password) {
    logger.error('Usage: ts-node src/cli/setup-admin.ts <username> <email> <password>')
    process.exit(1)
  }

  if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    logger.error('Password must be at least 8 chars with letters and numbers')
    process.exit(1)
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  })
  const prisma = app.get(PrismaService)

  try {
    // 检查是否已存在 super_admin
    const existingAdmin = await prisma.user.findFirst({
      where: { role: UserRole.super_admin },
    })
    if (existingAdmin) {
      logger.error(`Super admin already exists: ${existingAdmin.username}`)
      process.exit(1)
    }

    // 检查用户名/邮箱
    const existsUsername = await prisma.user.findUnique({ where: { username } })
    if (existsUsername) {
      logger.error(`Username already exists: ${username}`)
      process.exit(1)
    }
    const existsEmail = await prisma.user.findUnique({ where: { email } })
    if (existsEmail) {
      logger.error(`Email already exists: ${email}`)
      process.exit(1)
    }

    const passwordHash = await HashUtil.hash(password)
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        role: UserRole.super_admin,
        status: UserStatus.active,
        emailVerifiedAt: new Date(),
      },
    })

    logger.log(`Super admin created: ${user.username} (${user.email})`)
    logger.log('Please keep the password safe. You can now login at /admin')
  } catch (err) {
    logger.error(`Setup failed: ${(err as Error).message}`)
    process.exit(1)
  } finally {
    await app.close()
  }
}

bootstrap()
