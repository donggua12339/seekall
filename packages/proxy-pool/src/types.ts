export type ProxyRegion = 'cn' | 'foreign' | 'unknown'
export type ProxyProtocol = 'http' | 'https' | 'socks4' | 'socks5'

export interface ProxyEntry {
  host: string
  port: number
  protocol: ProxyProtocol
  /** 出口区域：大陆 / 海外 / 未知 */
  region: ProxyRegion
  /** 出口国家码（如 CN / US / JP），未知则缺省 */
  country?: string
  /** 最近一次测速延迟 ms */
  latencyMs: number
  /** 来源标识（thespeedx / monosans / proxyscrape-cn ...） */
  source: string
  /** 最近测试时间戳 */
  lastTested: number
  /** 运行时连续失败计数（用于剔除） */
  fails: number
}

export interface PoolStats {
  total: number
  cn: number
  foreign: number
  unknown: number
  avgLatencyMs: number
}
