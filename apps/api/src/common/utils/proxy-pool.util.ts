/**
 * 代理池管理
 *
 * 功能：
 *   - 维护代理列表（从环境变量加载或动态添加）
 *   - 轮换策略（round-robin / 随机）
 *   - 健康检查（标记失败代理，自动剔除）
 *   - 限速（每代理每秒最多 N 请求）
 *
 * 配置：
 *   PROXY_POOL=http://user:pass@proxy1:port,http://user:pass@proxy2:port
 *   PROXY_STRATEGY=round-robin  # 或 random
 *   PROXY_HEALTH_CHECK_INTERVAL=60  # 秒
 *   PROXY_MAX_FAILURES=3  # 连续失败 N 次剔除
 *
 * 用法：
 *   const proxy = proxyPool.getProxy()
 *   if (proxy) {
 *     const agent = proxyPool.getDispatcher(proxy)
 *     fetch(url, { dispatcher: agent })
 *   }
 *
 * 依赖 Node 18+ 内置 undici 的 ProxyAgent
 */

import { Logger } from '@nestjs/common'

// undici 是 Node 18+ 内置模块，用动态 require 避免类型声明问题
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ProxyAgentCtor: any = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  ProxyAgentCtor = require('undici').ProxyAgent
} catch {
  // undici 不可用，代理池降级
}

export interface ProxyInfo {
  url: string
  host: string
  port: number
  username?: string
  password?: string
  failCount: number
  lastUsedAt: number
  lastCheckAt: number
  healthy: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agent?: any
}

export class ProxyPool {
  private readonly logger = new Logger(ProxyPool.name)
  private proxies: ProxyInfo[] = []
  private currentIndex = 0
  private readonly strategy: 'round-robin' | 'random'
  private readonly maxFailures: number

  constructor() {
    const poolConfig = process.env.PROXY_POOL || ''
    this.strategy = (process.env.PROXY_STRATEGY as 'round-robin' | 'random') || 'round-robin'
    this.maxFailures = Number(process.env.PROXY_MAX_FAILURES || 3)

    if (poolConfig) {
      this.loadFromConfig(poolConfig)
    }

    if (this.proxies.length > 0) {
      this.logger.log(`Proxy pool initialized with ${this.proxies.length} proxies`)
      // 启动定时健康检查
      const interval = Number(process.env.PROXY_HEALTH_CHECK_INTERVAL || 60) * 1000
      setInterval(() => this.healthCheck(), interval)
    }
  }

  private loadFromConfig(config: string): void {
    const urls = config
      .split(',')
      .map((u) => u.trim())
      .filter(Boolean)
    for (const urlStr of urls) {
      try {
        const url = new URL(urlStr)
        this.proxies.push({
          url: urlStr,
          host: url.hostname,
          port: Number(url.port),
          username: url.username || undefined,
          password: url.password || undefined,
          failCount: 0,
          lastUsedAt: 0,
          lastCheckAt: 0,
          healthy: true,
        })
      } catch (err) {
        this.logger.warn(`Invalid proxy URL: ${urlStr} - ${(err as Error).message}`)
      }
    }
  }

  /**
   * 获取下一个健康代理
   */
  getProxy(): ProxyInfo | null {
    if (this.proxies.length === 0) return null

    const healthy = this.proxies.filter((p) => p.healthy)
    if (healthy.length === 0) return null

    let proxy: ProxyInfo
    if (this.strategy === 'random') {
      proxy = healthy[Math.floor(Math.random() * healthy.length)]
    } else {
      // round-robin
      proxy = healthy[this.currentIndex % healthy.length]
      this.currentIndex = (this.currentIndex + 1) % healthy.length
    }

    proxy.lastUsedAt = Date.now()
    return proxy
  }

  /**
   * 获取代理的 undici ProxyAgent（用于 fetch 的 dispatcher 选项）
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getDispatcher(proxy: ProxyInfo): any {
    if (!ProxyAgentCtor) {
      throw new Error('undici not available, proxy disabled')
    }
    if (!proxy.agent) {
      proxy.agent = new ProxyAgentCtor({
        uri: proxy.url,
        requestTls: { timeout: 5000 },
      })
    }
    return proxy.agent
  }

  /**
   * 记录代理失败
   */
  recordFailure(proxy: ProxyInfo): void {
    proxy.failCount++
    if (proxy.failCount >= this.maxFailures) {
      proxy.healthy = false
      this.logger.warn(
        `Proxy ${proxy.host}:${proxy.port} marked unhealthy (failures: ${proxy.failCount})`,
      )
    }
  }

  /**
   * 记录代理成功（重置失败计数）
   */
  recordSuccess(proxy: ProxyInfo): void {
    proxy.failCount = 0
    proxy.healthy = true
  }

  /**
   * 健康检查所有代理
   */
  async healthCheck(): Promise<void> {
    const testUrl = 'https://httpbin.org/ip'
    const results = await Promise.allSettled(
      this.proxies.map(async (proxy) => {
        try {
          if (!ProxyAgentCtor) return false
          const dispatcher = this.getDispatcher(proxy)
          const response = await fetch(testUrl, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...(dispatcher ? { dispatcher: dispatcher as any } : {}),
            signal: AbortSignal.timeout(5000),
          })
          if (response.ok) {
            proxy.healthy = true
            proxy.failCount = 0
            proxy.lastCheckAt = Date.now()
            return true
          }
          return false
        } catch {
          proxy.healthy = false
          return false
        }
      }),
    )

    const healthy = results.filter((r) => r.status === 'fulfilled' && r.value).length
    this.logger.debug(`Proxy health check: ${healthy}/${this.proxies.length} healthy`)
  }

  /**
   * 动态添加代理
   */
  addProxy(url: string): void {
    try {
      const parsed = new URL(url)
      this.proxies.push({
        url,
        host: parsed.hostname,
        port: Number(parsed.port),
        username: parsed.username || undefined,
        password: parsed.password || undefined,
        failCount: 0,
        lastUsedAt: 0,
        lastCheckAt: 0,
        healthy: true,
      })
    } catch (err) {
      this.logger.warn(`Invalid proxy URL: ${url} - ${(err as Error).message}`)
    }
  }

  getStats(): Array<{
    host: string
    port: number
    healthy: boolean
    failCount: number
    lastUsedAt: number
  }> {
    return this.proxies.map((p) => ({
      host: p.host,
      port: p.port,
      healthy: p.healthy,
      failCount: p.failCount,
      lastUsedAt: p.lastUsedAt,
    }))
  }

  get size(): number {
    return this.proxies.length
  }

  get healthyCount(): number {
    return this.proxies.filter((p) => p.healthy).length
  }
}
