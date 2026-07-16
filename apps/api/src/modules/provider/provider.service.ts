import { Injectable, Logger, Inject } from '@nestjs/common'
import * as Sentry from '@sentry/node'
import { Provider, SearchQuery, SearchResult } from './interfaces/provider.interface'
import { UrlUtil } from '../../common/utils/url.util'
import { CircuitBreaker } from '../../common/utils/circuit-breaker.util'
import { normalizeTitle } from '../../common/utils/simhash.util'

export interface ProviderStats {
  name: string
  successCount: number
  failCount: number
  avgDurationMs: number
  lastSuccessAt: number | null
  lastFailAt: number | null
  score: number // 0-100，综合健康度
  autoDisabled: boolean
  autoDisabledAt: number | null
  autoDisabledReason?: string
  circuitState: 'closed' | 'open' | 'half-open'
}

// 健康度阈值
const SCORE_DISABLE_THRESHOLD = 30 // 低于此分自动降级
const AUTO_DISABLE_MIN_FAILURES = 5 // 至少失败 N 次才触发降级（避免新启动时抖动）

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name)
  private readonly stats = new Map<string, ProviderStats>()
  // 运行时禁用状态（独立于 Provider.enabled 配置项，避免修改 readonly 字段）
  private readonly disabledAt = new Map<string, { at: number; reason: string }>()
  // 每个 Provider 一个熔断器
  private readonly breakers = new Map<string, CircuitBreaker>()
  // 熔断事件去重告警（同一 Provider 30s 内只告警一次）
  private readonly breakerAlertedAt = new Map<string, number>()

  constructor(@Inject('PROVIDERS') private readonly providers: Provider[]) {
    // 初始化每个 Provider 的统计和熔断器
    for (const p of providers) {
      this.stats.set(p.name, {
        name: p.name,
        successCount: 0,
        failCount: 0,
        avgDurationMs: 0,
        lastSuccessAt: null,
        lastFailAt: null,
        score: 100,
        autoDisabled: false,
        autoDisabledAt: null,
        circuitState: 'closed',
      })
      this.breakers.set(p.name, new CircuitBreaker(p.name))
    }
  }

  getActiveProviders(): Provider[] {
    return this.providers.filter((p) => p.enabled && !this.disabledAt.has(p.name))
  }

  /**
   * 获取未熔断的 Provider（熔断的 Provider 跳过，避免浪费请求）
   */
  private getCallProviders(): Provider[] {
    return this.getActiveProviders().filter((p) => {
      const breaker = this.breakers.get(p.name)
      return breaker ? breaker.allow() : true
    })
  }

  /**
   * 手动/自动禁用 Provider
   */
  disableProvider(name: string, reason: string): boolean {
    if (this.disabledAt.has(name)) return false
    this.disabledAt.set(name, { at: Date.now(), reason })
    const s = this.stats.get(name)
    if (s) {
      s.autoDisabled = true
      s.autoDisabledAt = Date.now()
      s.autoDisabledReason = reason
    }
    this.logger.warn(`Provider ${name} auto-disabled: ${reason}`)
    Sentry.captureMessage(`Provider ${name} auto-disabled: ${reason}`, 'warning')
    return true
  }

  /**
   * 恢复 Provider
   */
  enableProvider(name: string): boolean {
    if (!this.disabledAt.has(name)) return false
    this.disabledAt.delete(name)
    const s = this.stats.get(name)
    if (s) {
      s.autoDisabled = false
      s.autoDisabledAt = null
      s.autoDisabledReason = undefined
      // 重置统计，避免历史失败拖累评分
      s.successCount = 0
      s.failCount = 0
      s.score = 100
    }
    this.logger.log(`Provider ${name} re-enabled`)
    return true
  }

  isProviderDisabled(name: string): boolean {
    return this.disabledAt.has(name)
  }

  async searchAll(query: SearchQuery): Promise<{
    results: SearchResult[]
    errors: string[]
    durationMs: number
  }> {
    const startTime = Date.now()
    // 只调用未熔断的 Provider（熔断的跳过，避免浪费请求和拖慢响应）
    const callProviders = this.getCallProviders()

    if (callProviders.length === 0) {
      // 区分两种情况：无活跃 Provider vs 全部熔断
      const activeProviders = this.getActiveProviders()
      if (activeProviders.length === 0) {
        this.logger.warn('No active provider')
        return { results: [], errors: ['no active provider'], durationMs: 0 }
      }
      // 有活跃 Provider 但全部熔断
      const openProviders = Array.from(this.breakers.entries())
        .filter(([, b]) => b.isOpen())
        .map(([n]) => n)
      this.logger.warn(`All providers circuit-open: ${openProviders.join(', ')}`)
      return { results: [], errors: ['all providers circuit-open'], durationMs: 0 }
    }

    // 并发搜索，单源失败不影响整体
    // 全局超时 8s（Provider 内部超时 4s + 不重试，留余量给并行 Provider）
    const settled = await Promise.allSettled(
      callProviders.map((p) => this.withTimeout(p.search(query), 8000, p.name)),
    )

    const results: SearchResult[] = []
    const errors: string[] = []

    settled.forEach((result, index) => {
      const provider = callProviders[index]
      const providerName = provider.name
      const elapsed = Date.now() - startTime
      const breaker = this.breakers.get(providerName)!

      if (result.status === 'fulfilled') {
        results.push(...result.value)
        console.log(`[Provider] ${providerName}: ${result.value.length} results (${elapsed}ms)`)
        this.logger.log(`Provider ${providerName}: ${result.value.length} results (${elapsed}ms)`)
        this.recordSuccess(providerName, elapsed)
        breaker.recordSuccess()
      } else {
        errors.push(`${providerName}: ${(result.reason as Error).message}`)
        this.recordFailure(providerName)
        breaker.recordFailure()
        // 熔断器刚打开时告警一次
        if (breaker.isOpen()) {
          this.alertCircuitOpen(providerName, (result.reason as Error).message)
        }
        this.logger.warn(`Provider ${providerName} failed: ${(result.reason as Error).message}`)
      }
    })

    // 同步熔断器状态到 stats
    for (const [name, breaker] of this.breakers) {
      const s = this.stats.get(name)
      if (s) s.circuitState = breaker.getState()
    }

    // URL 去重
    const deduped = this.deduplicate(results)
    // 交错排序：不同 Provider 的结果均匀分布，避免单源霸占前几页
    const interleaved = this.interleave(deduped)
    this.logger.log(
      `SearchAll: ${results.length} raw -> ${deduped.length} deduped -> ${interleaved.length} interleaved`,
    )

    return {
      results: interleaved,
      errors,
      durationMs: Date.now() - startTime,
    }
  }

  /**
   * 交错排序：按 source 分组，轮流取每个 source 的结果
   * 避免单个 Provider 的结果霸占前几页
   */
  private interleave(results: SearchResult[]): SearchResult[] {
    if (results.length === 0) return results

    // 按 source 分组
    const groups = new Map<string, SearchResult[]>()
    for (const r of results) {
      const key = r.source || 'unknown'
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key)!.push(r)
    }

    // 轮流从每个 group 取一个
    const result: SearchResult[] = []
    const groupArrays = Array.from(groups.values())
    let idx = 0
    while (true) {
      let added = false
      for (const arr of groupArrays) {
        if (idx < arr.length) {
          result.push(arr[idx])
          added = true
        }
      }
      if (!added) break
      idx++
    }

    return result
  }

  /**
   * 熔断器打开时告警（去重：同一 Provider 30s 内只告警一次）
   * 通过事件机制通知 TG Bot（由 SearchService 订阅）
   */
  private alertCircuitOpen(providerName: string, reason: string): void {
    const now = Date.now()
    const lastAlerted = this.breakerAlertedAt.get(providerName) || 0
    if (now - lastAlerted < 30000) return // 30s 内已告警
    this.breakerAlertedAt.set(providerName, now)

    const msg = `⚠️ Provider 熔断: ${providerName}\n原因: ${reason}\n时间: ${new Date().toISOString()}`
    this.logger.warn(msg)
    Sentry.captureMessage(msg, 'warning')

    // 通过全局 EventEmitter 通知 TG Bot（如果有）
    if (
      typeof globalThis !== 'undefined' &&
      (globalThis as { __seekallEmitter?: { emit: (e: string, d: unknown) => void } })
        .__seekallEmitter
    ) {
      ;(
        globalThis as { __seekallEmitter: { emit: (e: string, d: unknown) => void } }
      ).__seekallEmitter.emit('provider:circuit-open', { providerName, reason, timestamp: now })
    }
  }

  /**
   * 记录 Provider 成功调用
   */
  private recordSuccess(name: string, durationMs: number): void {
    const s = this.stats.get(name)
    if (!s) return
    s.successCount++
    s.lastSuccessAt = Date.now()
    // 滑动平均响应时间
    s.avgDurationMs =
      s.avgDurationMs === 0 ? durationMs : Math.round(s.avgDurationMs * 0.7 + durationMs * 0.3)
    this.recalculateScore(s)
  }

  /**
   * 记录 Provider 失败
   */
  private recordFailure(name: string): void {
    const s = this.stats.get(name)
    if (!s) return
    s.failCount++
    s.lastFailAt = Date.now()
    this.recalculateScore(s)

    // 自动降级：分数过低 + 累计失败次数足够 + 尚未被禁用
    if (
      !this.disabledAt.has(name) &&
      s.score < SCORE_DISABLE_THRESHOLD &&
      s.failCount >= AUTO_DISABLE_MIN_FAILURES
    ) {
      this.disableProvider(
        name,
        `score=${s.score}, failures=${s.failCount}, avgMs=${s.avgDurationMs}`,
      )
    }
  }

  /**
   * 计算健康度评分（0-100）
   * - 成功率权重 60%
   * - 响应速度权重 30%（<2s 满分，>10s 扣完）
   * - 最近活跃权重 10%（1 小时内有成功满分）
   */
  private recalculateScore(s: ProviderStats): void {
    const total = s.successCount + s.failCount
    const successRate = total > 0 ? s.successCount / total : 1
    const speedScore =
      s.avgDurationMs === 0 ? 1 : Math.max(0, Math.min(1, (10000 - s.avgDurationMs) / 8000))
    const recencyScore = s.lastSuccessAt && Date.now() - s.lastSuccessAt < 3600000 ? 1 : 0.3
    s.score = Math.round(successRate * 60 + speedScore * 30 + recencyScore * 10)
  }

  /**
   * 获取所有 Provider 健康度统计
   */
  getStats(): ProviderStats[] {
    return Array.from(this.stats.values())
  }

  /**
   * 获取指定 Provider 健康度
   */
  getStat(name: string): ProviderStats | undefined {
    return this.stats.get(name)
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number, _providerName: string): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`timeout after ${ms}ms`))
      }, ms)

      promise
        .then((result) => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch((err) => {
          clearTimeout(timer)
          reject(err)
        })
    })
  }

  private deduplicate(results: SearchResult[]): SearchResult[] {
    const seen = new Map<string, SearchResult>()
    // SimHash 去重暂时禁用（误判率高，会去掉不同源的相关结果）
    // const simDedup = new SimHashDeduplicator(3)

    for (const r of results) {
      // Level 1: URL hash 去重（相同 URL 直接跳过，不论标题是否相同）
      const urlKey = UrlUtil.hash(UrlUtil.normalize(r.url))
      if (seen.has(urlKey)) continue

      // Level 2: 标题 normalize 去重（完全相同的 normalize 标题）
      const normalizedTitle = normalizeTitle(r.title || '')
      const titleKey = UrlUtil.hash(normalizedTitle)

      // Level 3: SimHash 相似度去重（暂时禁用）
      // if (normalizedTitle && simDedup.isDuplicate(r.title || '')) {
      //   continue
      // }

      // URL 已记录，后续相同 URL 会被跳过；标题仅作辅助区分
      const finalKey = `${urlKey}|${titleKey}`
      if (!seen.has(finalKey)) {
        seen.set(urlKey, r)
        seen.set(finalKey, r)
      }
    }
    return Array.from(seen.values()).filter((r, i, arr) => arr.indexOf(r) === i)
  }

  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {}
    await Promise.all(
      this.providers.map(async (p) => {
        try {
          results[p.name] = await p.healthCheck()
        } catch {
          results[p.name] = false
        }
      }),
    )
    return results
  }

  /**
   * 自动恢复检查 - 对已自动降级的 Provider 调用 healthCheck
   * 通过则恢复，未通过则保持禁用
   * 由定时任务每 10 分钟调用一次
   */
  async autoRecover(): Promise<{ recovered: string[]; stillDown: string[] }> {
    const recovered: string[] = []
    const stillDown: string[] = []

    for (const p of this.providers) {
      if (!this.disabledAt.has(p.name)) continue
      try {
        const ok = await p.healthCheck()
        if (ok) {
          // 健康检查通过，恢复
          this.enableProvider(p.name)
          recovered.push(p.name)
        } else {
          stillDown.push(p.name)
        }
      } catch {
        stillDown.push(p.name)
      }
    }

    if (recovered.length > 0) {
      this.logger.log(`Providers recovered: ${recovered.join(', ')}`)
    }
    if (stillDown.length > 0) {
      this.logger.debug(`Providers still down: ${stillDown.join(', ')}`)
    }
    return { recovered, stillDown }
  }

  /**
   * 流式搜索 - 每个 Provider 完成后立即通过回调通知
   * 服务端去重：URL hash + 标题 normalize 联合去重（跨 Provider）
   * 返回所有去重后的结果供调用方缓存
   */
  async streamSearch(
    query: SearchQuery,
    onPartial: (provider: string, results: SearchResult[]) => void,
    onError: (provider: string, error: string) => void,
  ): Promise<{ errors: string[]; durationMs: number; allResults: SearchResult[] }> {
    const startTime = Date.now()
    const callProviders = this.getCallProviders()
    const seen = new Set<string>()
    const seenTitles = new Set<string>()
    const allResults: SearchResult[] = []
    const errors: string[] = []

    if (callProviders.length === 0) {
      return { errors: ['all providers circuit-open'], durationMs: 0, allResults }
    }

    await Promise.all(
      callProviders.map(async (p) => {
        const breaker = this.breakers.get(p.name)!
        try {
          const results = await this.withTimeout(p.search(query), 8000, p.name)
          const newResults = results.filter((r) => {
            // Level 1: URL hash 去重
            const urlKey = UrlUtil.hash(UrlUtil.normalize(r.url))
            if (seen.has(urlKey)) return false

            // Level 2: 标题 normalize 去重
            const normalizedTitle = normalizeTitle(r.title || '')
            const titleKey = UrlUtil.hash(normalizedTitle)
            const finalKey = `${urlKey}|${titleKey}`
            if (seenTitles.has(finalKey)) return false

            seen.add(urlKey)
            seenTitles.add(finalKey)
            return true
          })
          if (newResults.length > 0) {
            allResults.push(...newResults)
            onPartial(p.name, newResults)
          }
          this.recordSuccess(p.name, Date.now() - startTime)
          breaker.recordSuccess()
        } catch (err) {
          const msg = (err as Error).message
          errors.push(`${p.name}: ${msg}`)
          onError(p.name, msg)
          this.recordFailure(p.name)
          breaker.recordFailure()
          if (breaker.isOpen()) {
            this.alertCircuitOpen(p.name, msg)
          }
          this.logger.warn(`Provider ${p.name} failed: ${msg}`)
        }
      }),
    )

    return { errors, durationMs: Date.now() - startTime, allResults }
  }
}
