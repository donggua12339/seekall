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

    await this.prisma.cloudAccount.update({
      where: { id: account.id },
      data: { lastUsedAt: new Date() },
    })

    this.logger.log(`Transfer: user ${userId}, type ${type}, url ${resourceUrl}`)

    switch (type) {
      case 'quark':
        return this.transferQuark(resourceUrl, account.cookie)
      case 'aliyun':
        return this.transferAliyun(resourceUrl, account.cookie)
      default:
        return { message: `${type} 转存开发中`, supported: false }
    }
  }

  /**
   * 夸克网盘转存
   * 逆向 API：token -> detail -> save
   */
  private async transferQuark(
    shareUrl: string,
    cookie: string,
  ): Promise<{ message: string; supported: boolean; saved?: number }> {
    const QUARK_API = 'https://drive-pc.quark.cn/1/clouddrive'

    // 1. 解析 share_id
    const shareIdMatch = shareUrl.match(/\/s\/([a-zA-Z0-9]+)/)
    if (!shareIdMatch) {
      throw new BusinessException(ErrorCode.PARAM_ERROR, 400, '无效的夸克分享链接')
    }
    const shareId = shareIdMatch[1]

    // 提取 passcode（如有）
    const passcodeMatch = shareUrl.match(/[?&]pwd=([a-zA-Z0-9]+)/)
    const passcode = passcodeMatch ? passcodeMatch[1] : undefined

    const headers: Record<string, string> = {
      Cookie: cookie,
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      'Content-Type': 'application/json',
      Referer: 'https://pan.quark.cn/',
      Origin: 'https://pan.quark.cn',
    }

    try {
      // 2. 获取 share token
      const tokenRes = await fetch(
        `${QUARK_API}/share/sharepage/token?pr=ucpr&uc_param_str=&__dt=0&__t=${Date.now()}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ share_id: shareId, passcode: passcode || '' }),
        },
      )
      const tokenData = (await tokenRes.json()) as { status: number; data?: { stoken: string }; message?: string }
      if (tokenData.status !== 200 || !tokenData.data?.stoken) {
        throw new Error(tokenData.message || '获取 share token 失败（Cookie 可能过期）')
      }
      const stoken = tokenData.data.stoken

      // 3. 获取文件列表
      const detailRes = await fetch(
        `${QUARK_API}/share/sharepage/detail?pr=ucpr&uc_param_str=&__dt=0&__t=${Date.now()}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            share_id: shareId,
            stoken,
            pdir_fid: '0',
            force: 0,
            _page: 1,
            _size: 50,
          }),
        },
      )
      const detailData = (await detailRes.json()) as {
        status: number
        data?: { list: Array<{ fid: string; file_name: string; file_type: number; size: number }> }
        message?: string
      }
      if (detailData.status !== 200 || !detailData.data?.list) {
        throw new Error(detailData.message || '获取文件列表失败')
      }

      const files = detailData.data.list
      if (files.length === 0) {
        throw new Error('分享中没有文件')
      }

      // 4. 转存到根目录（fid: 0）
      const toFid = '0' // 根目录
      const saveRes = await fetch(
        `${QUARK_API}/file/save/files?pr=ucpr&uc_param_str=&__dt=0&__t=${Date.now()}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            fid_list: files.map((f) => f.fid),
            fid_token: stoken,
            to_fid: toFid,
            pwd_id: shareId,
            pdir_fid: '0',
          }),
        },
      )
      const saveData = (await saveRes.json()) as { status: number; message?: string }
      if (saveData.status !== 200) {
        throw new Error(saveData.message || '转存失败')
      }

      this.logger.log(`Quark transfer success: ${files.length} files from ${shareId}`)
      return {
        message: `转存成功，共 ${files.length} 个文件`,
        supported: true,
        saved: files.length,
      }
    } catch (err) {
      this.logger.error(`Quark transfer failed: ${(err as Error).message}`)
      throw new BusinessException(ErrorCode.INTERNAL_ERROR, 500, `夸克转存失败: ${(err as Error).message}`)
    }
  }

  /**
   * 阿里云盘转存（TODO）
   */
  private async transferAliyun(
    _shareUrl: string,
    _cookie: string,
  ): Promise<{ message: string; supported: boolean }> {
    // TODO: 逆向阿里云盘 API
    // 流程类似：refresh_token -> share_link -> save_to_drive
    return { message: '阿里云盘转存开发中', supported: false }
  }
}
