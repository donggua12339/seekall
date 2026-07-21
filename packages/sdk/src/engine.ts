import type {
  Rule,
  Hit,
  RuleContext,
  Engine,
  EngineOptions,
  EngineSearchOptions,
  RuleLogger,
  LicenseContext,
  RiskLevel,
} from './types.js'
import { TIER_PERFORMANCE } from './types.js'

/** 默认 logger: 转发到 console */
const defaultLogger: RuleLogger = {
  debug: (msg, data) => console.debug(`[seekall] ${msg}`, data ?? ''),
  info: (msg, data) => console.info(`[seekall] ${msg}`, data ?? ''),
  warn: (msg, data) => console.warn(`[seekall] ${msg}`, data ?? ''),
  error: (msg, data) => console.error(`[seekall] ${msg}`, data ?? ''),
}

const defaultLicense: LicenseContext = { tier: 'free' }

/** 简单内存缓存(付费用户独享,key = query + ruleNames hash) */
interface CacheEntry {
  hits: Hit[]
  expireAt: number
}

/**
 * 创建搜索引擎实例
 *
 * @example
 * ```ts
 * import { createEngine } from '@seekall/sdk'
 * import arxiv from '@seekall/rule-arxiv'
 *
 * const engine = createEngine({
 *   rules: [arxiv],
 *   license: { tier: 'monthly' }, // 付费用户: 10 并发 + 5s 超时 + 缓存
 *   cacheTtlSeconds: 300, // 5 分钟缓存
 * })
 * const hits = await engine.search('transformer')
 * ```
 */
export function createEngine(options: EngineOptions): Engine {
  const rules = new Map<string, Rule>()
  for (const r of options.rules) {
    rules.set(r.name, r)
  }

  const license = options.license ?? defaultLicense
  const logger = options.logger ?? defaultLogger

  // tier-based 性能参数(用户未显式设置时按 tier 阶梯)
  const tierPerf = TIER_PERFORMANCE[license.tier]
  const concurrency = Math.max(1, options.concurrency ?? tierPerf.concurrency)
  const timeoutMs = options.timeoutMs ?? tierPerf.timeoutMs
  const cacheTtlSeconds = options.cacheTtlSeconds ?? 0

  // 缓存(仅 cacheTtlSeconds > 0 时启用)
  const cache = new Map<string, CacheEntry>()

  /** 并发执行所有规则,返回 [ruleName, hits, error] */
  async function runRule(
    rule: Rule,
    query: string,
    parentSignal: AbortSignal,
  ): Promise<{ ruleName: string; hits: Hit[]; error?: Error }> {
    const ctrl = new AbortController()
    const ctx: RuleContext = { signal: ctrl.signal, license, logger }

    const onParentAbort = () => ctrl.abort()
    if (parentSignal.aborted) {
      ctrl.abort()
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true })
    }

    const timer = setTimeout(() => ctrl.abort(), timeoutMs)

    try {
      const hits = await rule.run(query, ctx)
      return { ruleName: rule.name, hits }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      logger.warn(`rule "${rule.name}" failed: ${error.message}`)
      return { ruleName: rule.name, hits: [], error }
    } finally {
      clearTimeout(timer)
      parentSignal.removeEventListener('abort', onParentAbort)
    }
  }

  /** 简单的并发池 */
  async function runAll(
    ruleList: Rule[],
    query: string,
    parentSignal: AbortSignal,
    onHit?: (hit: Hit, ruleName: string) => void,
    onError?: (err: Error, ruleName: string) => void,
  ): Promise<Array<{ ruleName: string; hits: Hit[]; error?: Error }>> {
    const results: Array<{ ruleName: string; hits: Hit[]; error?: Error }> = []
    const queue = [...ruleList]

    for (let i = 0; i < queue.length; i += concurrency) {
      if (parentSignal.aborted) break
      const batch = queue.slice(i, i + concurrency)
      const batchResults = await Promise.all(
        batch.map((r) => runRule(r, query, parentSignal)),
      )
      for (const r of batchResults) {
        if (r.error && onError) {
          onError(r.error, r.ruleName)
        }
        if (r.hits.length > 0 && onHit) {
          for (const h of r.hits) onHit(h, r.ruleName)
        }
        results.push(r)
      }
    }
    return results
  }

  /** 按 url 去重,保留首次出现的 Hit,合并 meta.sources */
  function dedupe(allHits: Array<{ ruleName: string; hits: Hit[] }>): Hit[] {
    const map = new Map<string, Hit>()
    for (const { ruleName, hits } of allHits) {
      for (const h of hits) {
        const existing = map.get(h.url)
        if (existing) {
          const sources = (existing.meta?.sources as string[] | undefined) ?? []
          if (!sources.includes(ruleName)) {
            sources.push(ruleName)
          }
          existing.meta = { ...existing.meta, sources }
        } else {
          map.set(h.url, {
            ...h,
            meta: { ...(h.meta ?? {}), sources: [ruleName] },
          })
        }
      }
    }
    return [...map.values()]
  }

  /** 生成缓存 key */
  function cacheKey(query: string): string {
    const ruleNames = [...rules.keys()].sort().join(',')
    return `${query}::${ruleNames}`
  }

  /** 清理过期缓存(惰性) */
  function cleanCache(): void {
    const now = Date.now()
    for (const [k, v] of cache) {
      if (v.expireAt < now) cache.delete(k)
    }
  }

  return {
    async search(query: string, options?: EngineSearchOptions): Promise<Hit[]> {
      const ctrl = new AbortController()
      if (options?.signal) {
        if (options.signal.aborted) ctrl.abort()
        else options.signal.addEventListener('abort', () => ctrl.abort(), { once: true })
      }

      const ruleList = [...rules.values()]
      if (ruleList.length === 0) {
        logger.info('search called with 0 rules')
        return []
      }

      // 缓存命中(仅付费用户)
      if (cacheTtlSeconds > 0) {
        cleanCache()
        const key = cacheKey(query)
        const cached = cache.get(key)
        if (cached && cached.expireAt > Date.now()) {
          logger.info(`cache hit: "${query}" (${cached.hits.length} hits)`)
          // 流式回调也要触发(模拟实时返回)
          if (options?.onHit) {
            for (const h of cached.hits) {
              options.onHit(h, (h.meta?.sources as string[] | undefined)?.[0] || 'cached')
            }
          }
          return cached.hits
        }
      }

      logger.info(
        `searching "${query}" across ${ruleList.length} rule(s) (concurrency=${concurrency}, timeout=${timeoutMs}ms, tier=${license.tier})`,
      )
      const results = await runAll(
        ruleList,
        query,
        ctrl.signal,
        options?.onHit,
        options?.onError,
      )
      const hits = dedupe(results)
      logger.info(`search done: ${hits.length} unique hits`)

      // 写缓存(仅付费用户)
      if (cacheTtlSeconds > 0 && hits.length > 0) {
        const key = cacheKey(query)
        cache.set(key, {
          hits,
          expireAt: Date.now() + cacheTtlSeconds * 1000,
        })
      }

      return hits
    },

    addRule(rule: Rule): void {
      rules.set(rule.name, rule)
      logger.debug(`rule added: ${rule.name}`)
    },

    removeRule(ruleName: string): boolean {
      const existed = rules.delete(ruleName)
      if (existed) logger.debug(`rule removed: ${ruleName}`)
      return existed
    },

    listRules(): Array<{ name: string; version: string; riskLevel: RiskLevel; description: string }> {
      return [...rules.values()].map((r) => ({
        name: r.name,
        version: r.version,
        riskLevel: r.riskLevel,
        description: r.description,
      }))
    },
  }
}
