import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitter } from 'events'

/**
 * 全局事件发射器（用于跨模块通信）
 * ProviderService 通过 globalThis.__seekallEmitter 发送熔断事件
 * TgAlertService 订阅事件并推 TG 通知
 */
declare global {
  // eslint-disable-next-line no-var
  var __seekallEmitter: EventEmitter | undefined
}

@Injectable()
export class TgAlertService implements OnModuleInit {
  private readonly logger = new Logger(TgAlertService.name)
  private readonly botToken: string
  private readonly chatId: string
  private readonly apiBase: string
  private readonly enabled: boolean
  private readonly emitter: EventEmitter

  constructor(private readonly configService: ConfigService) {
    this.botToken = this.configService.get<string>('TG_ALERT_BOT_TOKEN', '')
    this.chatId = this.configService.get<string>('TG_ALERT_CHAT_ID', '')
    // 支持自定义 TG API base（国内用 CF Worker 反代）
    this.apiBase = this.configService.get<string>('TG_API_BASE', 'https://api.telegram.org')
    this.enabled = this.botToken !== '' && this.chatId !== ''
    this.emitter = new EventEmitter()
    this.emitter.setMaxListeners(20)
  }

  onModuleInit() {
    // 注册全局 emitter，让 ProviderService 能发事件
    globalThis.__seekallEmitter = this.emitter

    if (!this.enabled) {
      this.logger.log('TG alert disabled (TG_ALERT_BOT_TOKEN or TG_ALERT_CHAT_ID not set)')
      return
    }

    // 订阅熔断事件
    this.emitter.on(
      'provider:circuit-open',
      (data: { providerName: string; reason: string; timestamp: number }) => {
        this.sendAlert(
          `⚠️ Provider 熔断\n名称: ${data.providerName}\n原因: ${data.reason}\n时间: ${new Date(data.timestamp).toLocaleString('zh-CN')}`,
        ).catch((err) => this.logger.debug(`Send circuit alert failed: ${(err as Error).message}`))
      },
    )

    // 订阅 0 结果率告警
    this.emitter.on('search:high-zero-rate', (data: { rate: number; window: string }) => {
      this.sendAlert(
        `📊 搜索 0 结果率告警\n0 结果率: ${(data.rate * 100).toFixed(1)}%\n时间窗口: ${data.window}\n时间: ${new Date().toLocaleString('zh-CN')}`,
      ).catch((err) => this.logger.debug(`Send zero-rate alert failed: ${(err as Error).message}`))
    })

    this.logger.log('TG alert service initialized')
  }

  /**
   * 发送 TG 消息
   */
  async sendAlert(message: string): Promise<void> {
    if (!this.enabled) return

    try {
      const url = `${this.apiBase}/bot${this.botToken}/sendMessage`
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        const text = await response.text()
        this.logger.warn(`TG alert failed: HTTP ${response.status} - ${text}`)
      }
    } catch (err) {
      this.logger.debug(`TG alert error: ${(err as Error).message}`)
    }
  }

  /**
   * 外部模块调用：发送自定义告警
   */
  async alert(message: string): Promise<void> {
    await this.sendAlert(message)
  }
}
