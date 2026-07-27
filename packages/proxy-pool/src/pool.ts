import type { ProxyEntry, ProxyRegion, PoolStats } from './types.js'

const MAX_FAILS = 3

export function toProxyUrl(e: ProxyEntry): string {
  return `http://${e.host}:${e.port}`
}

/**
 * 运行时代理池：按区域取代理，失败累计剔除。
 * 选取策略：区域内按延迟升序，从前 N 个里随机（分散负载）。
 */
export class ProxyPool {
  private entries: ProxyEntry[]
  private byKey = new Map<string, ProxyEntry>()

  constructor(entries: ProxyEntry[]) {
    this.entries = entries.map((e) => ({ ...e }))
    for (const e of this.entries) this.byKey.set(this.key(e), e)
  }

  private key(e: ProxyEntry): string {
    return `${e.host}:${e.port}`
  }

  /** 取一个指定区域的代理 URL；无可用则返回 null。'any' 表示不限区域。 */
  getProxyUrl(region: ProxyRegion | 'any' = 'any'): string | null {
    const e = this.pick(region)
    return e ? toProxyUrl(e) : null
  }

  pick(region: ProxyRegion | 'any' = 'any'): ProxyEntry | null {
    let candidates = this.entries.filter((e) => e.fails < MAX_FAILS)
    if (region !== 'any') candidates = candidates.filter((e) => e.region === region)
    if (candidates.length === 0) return null

    candidates.sort((a, b) => a.latencyMs - b.latencyMs)
    const topN = candidates.slice(0, Math.min(10, candidates.length))
    return topN[Math.floor(Math.random() * topN.length)]
  }

  reportFailure(proxyUrl: string): void {
    const e = this.find(proxyUrl)
    if (!e) return
    e.fails++
    if (e.fails >= MAX_FAILS) {
      this.entries = this.entries.filter((x) => this.key(x) !== this.key(e))
      this.byKey.delete(this.key(e))
    }
  }

  reportSuccess(proxyUrl: string): void {
    const e = this.find(proxyUrl)
    if (e) e.fails = 0
  }

  private find(proxyUrl: string): ProxyEntry | undefined {
    // 兼容 http:// / https:// / socks4:// / socks5:// / 裸 host:port
    const hp = proxyUrl.replace(/^[a-z0-9]+:\/\//i, '')
    return this.byKey.get(hp)
  }

  get size(): number {
    return this.entries.length
  }

  stats(): PoolStats {
    const cn = this.entries.filter((e) => e.region === 'cn').length
    const foreign = this.entries.filter((e) => e.region === 'foreign').length
    const unknown = this.entries.filter((e) => e.region === 'unknown').length
    const avg =
      this.entries.length > 0
        ? Math.round(this.entries.reduce((s, e) => s + e.latencyMs, 0) / this.entries.length)
        : 0
    return { total: this.entries.length, cn, foreign, unknown, avgLatencyMs: avg }
  }
}
