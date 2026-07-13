import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { BusinessException } from '../../common/filters/http-exception.filter'
import { ErrorCode } from '../../common/constants/error-codes'

@Injectable()
export class CloudAccountService {
  private readonly logger = new Logger(CloudAccountService.name)

  constructor(private readonly prisma: PrismaService) {}

  async list(userId: bigint) {
    if (!this.prisma.isAvailable()) return []
    return this.prisma.cloudAccount.findMany({
      where: { userId },
      select: {
        id: true,
        type: true,
        remark: true,
        status: true,
        lastUsedAt: true,
        createdAt: true,
      },
    })
  }

  async add(userId: bigint, type: string, cookie: string, remark?: string) {
    if (!this.prisma.isAvailable()) {
      throw new BusinessException(ErrorCode.INTERNAL_ERROR, 503)
    }

    const validTypes = ['quark', 'aliyun', 'baidu', 'xunlei', '115']
    if (!validTypes.includes(type)) {
      throw new BusinessException(ErrorCode.PARAM_ERROR, 400, `不支持的网盘类型: ${type}`)
    }

    if (!cookie || cookie.length < 10) {
      throw new BusinessException(ErrorCode.PARAM_ERROR, 400, 'Cookie 无效')
    }

    // upsert：每个用户每种网盘只能有一个账号
    const account = await this.prisma.cloudAccount.upsert({
      where: { userId_type: { userId, type } },
      create: { userId, type, cookie, remark, status: 'active' },
      update: { cookie, remark, status: 'active' },
    })

    this.logger.log(`Cloud account saved: user ${userId}, type ${type}`)
    return { id: account.id, type: account.type, remark: account.remark, status: account.status }
  }

  async remove(userId: bigint, id: bigint) {
    if (!this.prisma.isAvailable()) {
      throw new BusinessException(ErrorCode.INTERNAL_ERROR, 503)
    }

    const account = await this.prisma.cloudAccount.findUnique({ where: { id } })
    if (!account || account.userId !== userId) {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404, '网盘账号不存在')
    }

    await this.prisma.cloudAccount.delete({ where: { id } })
    this.logger.log(`Cloud account removed: user ${userId}, id ${id}`)
    return { message: '已删除' }
  }

  /**
   * 转存资源到用户网盘
   * TODO: 实现各网盘的转存 API 调用
   */
  async transfer(userId: bigint, resourceUrl: string, type: string) {
    if (!this.prisma.isAvailable()) {
      throw new BusinessException(ErrorCode.INTERNAL_ERROR, 503)
    }

    const account = await this.prisma.cloudAccount.findUnique({
      where: { userId_type: { userId, type } },
    })

    if (!account || account.status !== 'active') {
      throw new BusinessException(ErrorCode.NOT_FOUND, 404, `未配置 ${type} 网盘账号`)
    }

    // 更新最后使用时间
    await this.prisma.cloudAccount.update({
      where: { id: account.id },
      data: { lastUsedAt: new Date() },
    })

    // TODO: 实现转存逻辑
    // - quark: 调用夸克网盘 API 转存分享链接
    // - aliyun: 调用阿里云盘 API
    // - baidu: 调用百度网盘 API
    // 需要逆向各网盘 API，有合规风险，暂不实现

    this.logger.log(`Transfer requested: user ${userId}, type ${type}, url ${resourceUrl}`)

    return {
      message: '转存功能开发中，当前仅记录请求',
      supported: false,
      url: resourceUrl,
    }
  }
}
