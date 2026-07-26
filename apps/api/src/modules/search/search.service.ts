import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'

/** 单条搜索结果 */
export interface SearchHit {
  title: string
  url: string
  snippet?: string
  source?: string
  meta?: Record<string, unknown>
}

/** 来源统计 */
export interface SourceStat {
  domain: string
  label: string
  category: string
  count: number
}

/** 搜索响应 */
export interface SearchResult {
  query: string
  total: number
  elapsedMs: number
  sources: SourceStat[]
  results: SearchHit[]
}

/** 规则对象（运行期从 ESM 包动态加载，这里只声明用到的形状） */
interface LoadedRule {
  name: string
  version: string
  run(query: string, ctx: unknown): Promise<SearchHit[]>
}

/** 域名 → 中文名映射（用于前端展示） */
const SOURCE_LABELS: Record<string, string> = {
  'ghxi.com': '果核剥壳',
  '423down.com': '423down',
  'mpyit.com': '殁漂遥',
  'isharepc.com': '乐软',
  'appinn.com': '小众软件',
  'iplaysoft.com': '异次元软件',
  'acgbns.com': 'ACGBNS',
  'yxssp.com': '游戏SSP',
  'naodai.org': '脑洞',
  'share.dmhy.org': '动漫花园',
  'mikanani.me': '蜜柑计划',
}

const CATEGORY_LABELS: Record<string, string> = {
  software: '软件',
  game: '游戏',
  anime: '动漫',
  pan: '网盘',
  general: '综合',
}

/** 服务端整体搜索超时 */
const SEARCH_TIMEOUT_MS = 20_000

/**
 * 在 CJS 运行时加载 ESM 规则包。
 * TypeScript(module: commonjs)会把 `import()` 转译成 require()，对 ESM 包会失败；
 * 用 new Function 包一层，交给 Node 原生的动态 import()，从而真正按 ESM 加载。
 */
const importEsm = new Function('specifier', 'return import(specifier)') as (
  specifier: string,
) => Promise<Record<string, unknown>>

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name)
  private rulePromise: Promise<LoadedRule> | null = null

  /** 懒加载 + 缓存规则模块 */
  private loadRule(): Promise<LoadedRule> {
    if (!this.rulePromise) {
      this.rulePromise = importEsm('@seekall/rule-greenhub')
        .then((mod) => {
          const rule = (mod.default ?? mod.greenhubRule) as LoadedRule | undefined
          if (!rule || typeof rule.run !== 'function') {
            throw new Error('greenhub 规则模块格式异常')
          }
          this.logger.log(`greenhub 规则已加载: ${rule.name}@${rule.version}`)
          return rule
        })
        .catch((err) => {
          this.rulePromise = null // 失败后允许下次重试
          throw err
        })
    }
    return this.rulePromise
  }

  async search(query: string): Promise<SearchResult> {
    const trimmed = query.trim()
    const start = Date.now()

    let rule: LoadedRule
    try {
      rule = await this.loadRule()
    } catch (err) {
      this.logger.error(`加载 greenhub 规则失败: ${(err as Error).message}`)
      throw new ServiceUnavailableException('搜索服务暂不可用，请稍后重试')
    }

    const ctx = {
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      license: { tier: 'admin' as const },
      logger: {
        debug: () => undefined,
        info: (msg: string) => this.logger.debug(msg),
        warn: (msg: string) => this.logger.warn(msg),
        error: (msg: string) => this.logger.error(msg),
      },
    }

    let results: SearchHit[] = []
    try {
      results = await rule.run(trimmed, ctx)
    } catch (err) {
      this.logger.error(`greenhub 搜索失败: ${(err as Error).message}`)
      throw new ServiceUnavailableException('搜索执行失败，请稍后重试')
    }

    const elapsedMs = Date.now() - start

    // 按域名聚合统计
    const statMap = new Map<string, SourceStat>()
    for (const hit of results) {
      const domain = hit.source || 'unknown'
      const category = (hit.meta?.category as string) || 'general'
      const stat = statMap.get(domain)
      if (stat) {
        stat.count += 1
      } else {
        statMap.set(domain, {
          domain,
          label: SOURCE_LABELS[domain] || domain,
          category,
          count: 1,
        })
      }
    }
    const sources = [...statMap.values()].sort((a, b) => b.count - a.count)

    this.logger.log(
      `搜索 "${trimmed}": ${results.length} 条结果 / ${sources.length} 个来源 / ${elapsedMs}ms`,
    )

    return {
      query: trimmed,
      total: results.length,
      elapsedMs,
      sources,
      results,
    }
  }

  /** 暴露分类中文名给前端 */
  categoryLabel(key: string): string {
    return CATEGORY_LABELS[key] || key
  }
}
