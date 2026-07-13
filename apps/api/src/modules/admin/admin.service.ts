import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard() {
    const [
      userCount,
      paidUserCount,
      activeUserCount,
      searchCountToday,
      inviteCodeUnused,
      membershipCodeUnused,
      takedownPending,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { isPaid: true, deletedAt: null } }),
      this.prisma.user.count({ where: { status: 'active', deletedAt: null } }),
      this.prisma.searchLog.count({
        where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      this.prisma.inviteCode.count({ where: { status: 'unused' } }),
      this.prisma.membershipCode.count({ where: { status: 'unused' } }),
      this.prisma.takedownRecord.count({ where: { status: 'pending' } }),
    ])

    return {
      users: {
        total: userCount,
        paid: paidUserCount,
        active: activeUserCount,
      },
      searches: {
        today: searchCountToday,
      },
      codes: {
        inviteUnused: inviteCodeUnused,
        membershipUnused: membershipCodeUnused,
      },
      takedown: {
        pending: takedownPending,
      },
    }
  }

  async listUsers(page: number, pageSize: number, search?: string) {
    const where = search
      ? {
          OR: [
            { username: { contains: search } },
            { email: { contains: search } },
          ],
          deletedAt: null,
        }
      : { deletedAt: null }

    const [list, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          isPaid: true,
          paidUntil: true,
          status: true,
          badge: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ])
    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }

  async banUser(id: bigint, reason: string, adminId: bigint) {
    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action: 'ban_user',
        targetType: 'user',
        targetId: id,
        detail: { reason },
      },
    })
    return this.prisma.user.update({
      where: { id },
      data: { status: 'banned' as const, bannedReason: reason },
    })
  }

  async unbanUser(id: bigint, adminId: bigint) {
    await this.prisma.adminAuditLog.create({
      data: {
        adminId,
        action: 'unban_user',
        targetType: 'user',
        targetId: id,
      },
    })
    return this.prisma.user.update({
      where: { id },
      data: { status: 'active' as const, bannedReason: null },
    })
  }

  async auditLogs(page: number, pageSize: number) {
    const [list, total] = await Promise.all([
      this.prisma.adminAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { admin: { select: { username: true } } },
      }),
      this.prisma.adminAuditLog.count(),
    ])
    return { list, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
  }
}
