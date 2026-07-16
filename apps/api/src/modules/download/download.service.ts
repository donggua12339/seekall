import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

interface Aria2Response {
  id: string
  jsonrpc: string
  result?: string
  error?: { code: number; message: string }
}

@Injectable()
export class DownloadService {
  private readonly rpcUrl: string
  private readonly secret: string

  constructor(private readonly configService: ConfigService) {
    this.rpcUrl = this.configService.get<string>('ARIA2_RPC_URL', 'http://localhost:6800/jsonrpc')
    this.secret = this.configService.get<string>('ARIA2_SECRET', '')
  }

  get enabled(): boolean {
    return !!this.rpcUrl
  }

  /**
   * 添加磁力链接到 aria2 下载队列
   */
  async addMagnet(magnet: string, options?: Record<string, string>): Promise<{ gid: string }> {
    if (!this.enabled) {
      throw new Error('aria2 未配置')
    }

    const params = [
      `token:${this.secret}`,
      [magnet],
      {
        ...options,
        'user-agent': 'Transmission/3.0',
      },
    ]

    const result = await this.rpc('aria2.addUri', params)
    return { gid: result.result! }
  }

  /**
   * 查询下载状态
   */
  async getStatus(gid: string): Promise<{
    status: string
    totalLength: string
    completedLength: string
    downloadSpeed: string
    files: Array<{ path: string; length: string }>
  }> {
    const params = [
      `token:${this.secret}`,
      gid,
      ['status', 'totalLength', 'completedLength', 'downloadSpeed', 'files'],
    ]
    const result = await this.rpc('aria2.tellStatus', params)
    return result.result as never
  }

  /**
   * 暂停下载
   */
  async pause(gid: string): Promise<void> {
    await this.rpc('aria2.pause', [`token:${this.secret}`, gid])
  }

  /**
   * 删除下载任务
   */
  async remove(gid: string): Promise<void> {
    await this.rpc('aria2.remove', [`token:${this.secret}`, gid])
  }

  /**
   * 获取活跃下载列表
   */
  async listActive(): Promise<
    Array<{
      gid: string
      status: string
      totalLength: string
      completedLength: string
      downloadSpeed: string
    }>
  > {
    const params = [`token:${this.secret}`]
    const result = await this.rpc('aria2.tellActive', params)
    return result.result as never
  }

  private async rpc(method: string, params: unknown[]): Promise<Aria2Response> {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      throw new Error(`aria2 HTTP ${response.status}`)
    }

    const data = (await response.json()) as Aria2Response
    if (data.error) {
      throw new Error(`aria2 error: ${data.error.message}`)
    }

    return data
  }
}
