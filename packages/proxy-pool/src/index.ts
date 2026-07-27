import { fetchCandidates } from './fetchers.js'
import { validateAll, type ValidateOptions } from './validator.js'
import { savePool, loadPool, qualityFilter, type QualityOptions } from './store.js'
import { ProxyPool } from './pool.js'
import type { PoolStats } from './types.js'

export * from './types.js'
export { fetchCandidates } from './fetchers.js'
export { validateAll } from './validator.js'
export { savePool, loadPool, qualityFilter, poolFilePath } from './store.js'
export { ProxyPool, toProxyUrl } from './pool.js'

export interface RefreshOptions {
  validate?: ValidateOptions
  quality?: QualityOptions
  file?: string
  logger?: (msg: string) => void
}

export interface RefreshResult {
  stats: PoolStats
  saved: number
}

/**
 * 一键刷新代理池：拉取候选 → 测速验证 → 质量筛选 → 存档。
 */
export async function refresh(opts: RefreshOptions = {}): Promise<RefreshResult> {
  const log = opts.logger || (() => {})

  log('[refresh] 1/4 拉取免费代理候选...')
  const candidates = await fetchCandidates(log)

  log('[refresh] 2/4 测速 + 区域探测...')
  const validated = await validateAll(candidates, { ...opts.validate, logger: log })

  log('[refresh] 3/4 质量筛选...')
  const good = qualityFilter(validated, opts.quality)
  log(`[refresh] 筛选后 ${good.length} 个优质代理`)

  log('[refresh] 4/4 存档...')
  await savePool(good, opts.file)

  const pool = new ProxyPool(good)
  const stats = pool.stats()
  log(
    `[refresh] 完成：总 ${stats.total} | 大陆 ${stats.cn} | 海外 ${stats.foreign} | 未知 ${stats.unknown} | 平均 ${stats.avgLatencyMs}ms`,
  )
  return { stats, saved: good.length }
}

// ── 运行时单例池（懒加载）──────────────────────────────────
let cachedPool: ProxyPool | null = null

/** 加载代理池单例（从 JSON）。无文件时返回空池。 */
export async function getPool(file?: string): Promise<ProxyPool> {
  if (!cachedPool) {
    const entries = await loadPool(file)
    cachedPool = new ProxyPool(entries)
  }
  return cachedPool
}

/** 测试用：重置单例缓存 */
export function _resetPool(): void {
  cachedPool = null
}
