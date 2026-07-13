import { Injectable, Logger, Inject } from '@nestjs/common'
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
}

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name)
  private readonly stats = new Map<string, ProviderStats>()

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
      })
    }
  }

  getActiveProviders(): Provider[] {
    return this.providers.filter((p) => p.enabled)
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
