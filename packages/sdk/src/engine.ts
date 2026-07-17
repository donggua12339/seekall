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

/** 默认 logger：转发到 console */
const defaultLogger: RuleLogger = {
  debug: (msg, data) => console.debug(`[seekall] ${msg}`, data ?? ''),
  info: (msg, data) => console.info(`[seekall] ${msg}`, data ?? ''),
  warn: (msg, data) => console.warn(`[seekall] ${msg}`, data ?? ''),
  error: (msg, data) => console.error(`[seekall] ${msg}`, data ?? ''),
}

const defaultLicense: LicenseContext = { tier: 'free' }

/**
 * 创建搜索引擎实例
 *
 * @example
 * ```ts
 * import { createEngine } from '@seekall/sdk'
 * import arxiv from '@seekall/rule-arxiv'
 *
 * const engine = createEngine({ rules: [arxiv] })
 * const hits = await engine.search('transformer')
 * ```
 */
export function createEngine(options: EngineOptions): Engine {
  const rules = new Map<string, Rule>()
  for (const r of options.rules) {
    rules.set(r.name, r)
  }

  const concurrency = Math.max(1, options.concurrency ?? 5)
  const timeoutMs = options.timeoutMs ?? 10_000
  const license = options.license ?? defaultLicense
  const logger = options.logger ?? defaultLogger

  /** 并发执行所有规则，返回 [ruleName, hits, error] */
  async function runRule(
    rule: Rule,
    query: string,
    parentSignal: AbortSignal,
  ): Promise<{ ruleName: string; hits: Hit[]; error?: Error }> {
    // 为单条规则创建独立的 AbortController，便于超时单独 abort
    const ctrl = new AbortController()
    const ctx: RuleContext = { signal: ctrl.signal, license, logger }

    // 父 signal 触发时也 abort 子
    const onParentAbort = () => ctrl.abort()
    if (parentSignal.aborted) {
      ctrl.abort()
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true })
    }

    // 超时定时器
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)

    try {
      const hits = await rule.run(query, ctx)
      return { ruleName: rule.name, hits }
    } catch (err) {
      // 单条规则抛错不影响其他规则
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
  ): Promise<Array<{ ruleName: string; hits: Hit[]; error?: Error }>> {
    const results: Array<{ ruleName: string; hits: Hit[]; error?: Error }> = []
    const queue = [...ruleList]

    // 简化的并发：分批跑，每批 concurrency 个
    for (let i = 0; i < queue.length; i += concurrency) {
      if (parentSignal.aborted) break
      const batch = queue.slice(i, i + concurrency)
      const batchResults = await Promise.all(
        batch.map((r) => runRule(r, query, parentSignal)),
      )
      for (const r of batchResults) {
        if (r.hits.length > 0 && onHit) {
          for (const h of r.hits) onHit(h, r.ruleName)
        }
        results.push(r)
      }
    }
    return results
  }

  /** 按 url 去重，保留首次出现的 Hit，合并 meta.sources */
  function dedupe(allHits: Array<{ ruleName: string; hits: Hit[] }>): Hit[] {
    const map = new Map<string, Hit>()
    for (const { ruleName, hits } of allHits) {
      for (const h of hits) {
        const existing = map.get(h.url)
        if (existing) {
          // 合并来源
          const sources = (existing.meta?.sources as string[] | undefined) ?? []
          if (!sources.includes(ruleName)) {
            sources.push(ruleName)
          }
          existing.meta = { ...existing.meta, sources }
        } else {
          // 首次出现
          map.set(h.url, {
            ...h,
            meta: { ...(h.meta ?? {}), sources: [ruleName] },
          })
        }
      }
    }
    return [...map.values()]
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

      logger.info(`searching "${query}" across ${ruleList.length} rule(s)`)
      const results = await runAll(ruleList, query, ctrl.signal, options?.onHit)
      const hits = dedupe(results)
      logger.info(`search done: ${hits.length} unique hits`)
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
