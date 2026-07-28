import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { RuleStatus } from '@prisma/client'

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

/** 搜索选项 */
export interface SearchOptions {
  /** 是否同时跑网盘搜索（无头浏览器，较慢） */
  pansou?: boolean
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

/** 各规则超时（ms）：greenhub 快，pansou 走无头浏览器较慢（封顶 30s 避免拖死整体） */
const RULE_TIMEOUT: Record<string, number> = {
  greenhub: 20_000,
  pansou: 30_000,
}

/** 规则包定义 */
const RULE_DEFS = {
  greenhub: { specifier: '@seekall/rule-greenhub', exportName: 'greenhubRule' },
  pansou: { specifier: '@seekall/rule-pansou', exportName: 'pansouRule' },
} as const

/**
 * npm 包名 → 引擎内置规则 key 的映射。
 * 只有"已打进 API 镜像"的规则才能真正执行；市场里其它规则（未内置）订阅了也不会跑。
 * greenhub 是底座（永远跑），pansou 等为订阅触发的可选规则。
 */
const PACKAGE_TO_RULE: Record<string, keyof typeof RULE_DEFS> = {
  '@seekall/rule-greenhub': 'greenhub',
  '@seekall/rule-pansou': 'pansou',
}

/** 底座规则：无论是否订阅都会执行 */
const BASE_RULES: Array<keyof typeof RULE_DEFS> = ['greenhub']

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
  private ruleCache = new Map<string, Promise<LoadedRule>>()

  constructor(private readonly prisma: PrismaService) {}

  /** 懒加载 + 缓存单个规则模块 */
  private loadRule(key: keyof typeof RULE_DEFS): Promise<LoadedRule> {
    const cached = this.ruleCache.get(key)
    if (cached) return cached

    const def = RULE_DEFS[key]
    const promise = importEsm(def.specifier)
      .then((mod) => {
        const rule = (mod.default ?? mod[def.exportName]) as LoadedRule | undefined
        if (!rule || typeof rule.run !== 'function') {
          throw new Error(`${key} 规则模块格式异常`)
        }
        this.logger.log(`${key} 规则已加载: ${rule.name}@${rule.version}`)
        return rule
      })
      .catch((err) => {
        this.ruleCache.delete(key) // 失败后允许下次重试
        throw err
      })

    this.ruleCache.set(key, promise)
    return promise
  }

  /** 跑单个规则，带独立超时；失败返回空数组（不阻塞其它源） */
  private async runRule(key: keyof typeof RULE_DEFS, query: string): Promise<SearchHit[]> {
    let rule: LoadedRule
    try {
      rule = await this.loadRule(key)
    } catch (err) {
      this.logger.error(`加载 ${key} 规则失败: ${(err as Error).message}`)
      return []
    }

    const ctx = {
      signal: AbortSignal.timeout(RULE_TIMEOUT[key]),
      license: { tier: 'admin' as const },
      logger: {
        debug: () => undefined,
        info: (msg: string) => this.logger.debug(msg),
        warn: (msg: string) => this.logger.warn(msg),
        error: (msg: string) => this.logger.error(msg),
      },
    }

    try {
      return await rule.run(query, ctx)
    } catch (err) {
      this.logger.error(`${key} 搜索失败: ${(err as Error).message}`)
      return []
    }
  }

  /** 取用户已订阅、且引擎内置可执行的规则 key（订阅接通搜索的核心） */
  private async subscribedRuleKeys(userId: bigint): Promise<Array<keyof typeof RULE_DEFS>> {
    try {
      const subs = await this.prisma.ruleSubscription.findMany({
        where: { userId, rule: { status: RuleStatus.published } },
        select: { rule: { select: { npmPackage: true } } },
      })
      const keys: Array<keyof typeof RULE_DEFS> = []
      for (const s of subs) {
        const key = PACKAGE_TO_RULE[s.rule.npmPackage]
        if (key) keys.push(key)
      }
      return keys
    } catch (err) {
      this.logger.warn(`读取订阅规则失败: ${(err as Error).message}`)
      return []
    }
  }

  async search(query: string, opts: SearchOptions = {}, userId?: bigint): Promise<SearchResult> {
    const trimmed = query.trim()
    const start = Date.now()

    // 底座规则（greenhub）永远跑；可选规则由"订阅"或"显式开关"触发
    const keys = new Set<keyof typeof RULE_DEFS>(BASE_RULES)
    if (opts.pansou) keys.add('pansou')

    // 订阅接通：用户订阅的、且已内置进引擎的规则，加入本次搜索
    if (userId !== undefined) {
      for (const key of await this.subscribedRuleKeys(userId)) keys.add(key)
    }

    const settled = await Promise.allSettled([...keys].map((k) => this.runRule(k, trimmed)))

    const results: SearchHit[] = []
    for (const s of settled) {
      if (s.status === 'fulfilled') results.push(...s.value)
    }

    if (results.length === 0) {
      throw new ServiceUnavailableException('搜索服务暂不可用，请稍后重试')
    }

    // 按 url 去重（不同规则可能命中同一资源）
    const seen = new Set<string>()
    const deduped = results.filter((h) => {
      const key = h.url.replace(/\/$/, '')
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    const elapsedMs = Date.now() - start

    // 按域名聚合统计
    const statMap = new Map<string, SourceStat>()
    for (const hit of deduped) {
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
      `搜索 "${trimmed}" [执行: ${[...keys].join('+')}]: ${deduped.length} 条 / ${sources.length} 源 / ${elapsedMs}ms`,
    )

    return {
      query: trimmed,
      total: deduped.length,
      elapsedMs,
      sources,
      results: deduped,
    }
  }

  /** 暴露分类中文名给前端 */
  categoryLabel(key: string): string {
    return CATEGORY_LABELS[key] || key
  }
}
