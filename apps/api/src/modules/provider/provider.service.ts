import { Injectable, Logger, Inject } from '@nestjs/common'
import * as Sentry from '@sentry/node'
import { Provider, SearchQuery, SearchResult } from './interfaces/provider.interface'
import { UrlUtil } from '../../common/utils/url.util'

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

  constructor(@Inject('PROVIDERS') private readonly providers: Provider[]) {
    // 初始化每个 Provider 的统计
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
      })
    }
  }

  getActiveProviders(): Provider[] {
    return this.providers.filter((p) => p.enabled && !this.disabledAt.has(p.name))
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
    const activeProviders = this.getActiveProviders()

    if (activeProviders.length === 0) {
      return { results: [], errors: ['no active provider'], durationMs: 0 }
    }

    // 并发搜索，单源失败不影响整体
    const settled = await Promise.allSettled(
      activeProviders.map((p) => this.withTimeout(p.search(query), 10000, p.name)),
    )

    const results: SearchResult[] = []
    const errors: string[] = []

    settled.forEach((result, index) => {
      const provider = activeProviders[index]
      const providerName = provider.name
      const elapsed = Date.now() - startTime

      if (result.status === 'fulfilled') {
        results.push(...result.value)
        this.recordSuccess(providerName, elapsed)
      } else {
        errors.push(`${providerName}: ${(result.reason as Error).message}`)
        this.recordFailure(providerName)
        this.logger.warn(`Provider ${providerName} failed: ${(result.reason as Error).message}`)
      }
    })

    // URL 去重
    const deduped = this.deduplicate(results)

    return {
      results: deduped,
      errors,
      durationMs: Date.now() - startTime,
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
    s.avgDurationMs = s.avgDurationMs === 0
      ? durationMs
      : Math.round(s.avgDurationMs * 0.7 + durationMs * 0.3)
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
    const speedScore = s.avgDurationMs === 0
      ? 1
      : Math.max(0, Math.min(1, (10000 - s.avgDurationMs) / 8000))
    const recencyScore = s.lastSuccessAt && (Date.now() - s.lastSuccessAt) < 3600000
      ? 1
      : 0.3
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
    for (const r of results) {
      const key = UrlUtil.hash(UrlUtil.normalize(r.url))
      if (!seen.has(key)) {
        seen.set(key, r)
      }
    }
    return Array.from(seen.values())
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
   */
  async streamSearch(
    query: SearchQuery,
    onPartial: (provider: string, results: SearchResult[]) => void,
    onError: (provider: string, error: string) => void,
  ): Promise<{ errors: string[]; durationMs: number }> {
    const startTime = Date.now()
    const activeProviders = this.getActiveProviders()
    const seen = new Set<string>()
    const errors: string[] = []

    if (activeProviders.length === 0) {
      return { errors: ['no active provider'], durationMs: 0 }
    }

    await Promise.all(
      activeProviders.map(async (p) => {
        try {
          const results = await this.withTimeout(p.search(query), 10000, p.name)
          const newResults = results.filter((r) => {
            const key = UrlUtil.hash(UrlUtil.normalize(r.url))
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
          if (newResults.length > 0) {
            onPartial(p.name, newResults)
          }
          this.recordSuccess(p.name, Date.now() - startTime)
        } catch (err) {
          const msg = (err as Error).message
          errors.push(`${p.name}: ${msg}`)
          onError(p.name, msg)
          this.recordFailure(p.name)
          this.logger.warn(`Provider ${p.name} failed: ${msg}`)
        }
      }),
    )

    return { errors, durationMs: Date.now() - startTime }
  }
}
