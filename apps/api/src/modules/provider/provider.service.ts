import { Injectable, Logger, Inject } from '@nestjs/common'
import { Provider, SearchQuery, SearchResult } from './interfaces/provider.interface'
import { UrlUtil } from '../../common/utils/url.util'

@Injectable()
export class ProviderService {
  private readonly logger = new Logger(ProviderService.name)

  constructor(@Inject('PROVIDERS') private readonly providers: Provider[]) {}

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
      activeProviders.map((p) => this.withTimeout(p.search(query), 10000)),
    )

    const results: SearchResult[] = []
    const errors: string[] = []

    settled.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        results.push(...result.value)
      } else {
        const providerName = activeProviders[index].name
        errors.push(`${providerName}: ${(result.reason as Error).message}`)
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

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
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
}
