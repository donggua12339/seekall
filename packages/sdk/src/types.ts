/**
 * SeekAll SDK 类型定义
 */

/** 风险评级 L0-L4 */
export type RiskLevel = 0 | 1 | 2 | 3 | 4

/** 风险评级 enum（运行时值） */
export const RiskLevelEnum = {
  L0: 0 as RiskLevel,
  L1: 1 as RiskLevel,
  L2: 2 as RiskLevel,
  L3: 3 as RiskLevel,
  L4: 4 as RiskLevel,
} as const

/** 会员档 */
export type LicenseTier = 'free' | 'trial' | 'monthly' | 'lifetime' | 'admin'

/** 会员档 enum */
export const LicenseTierEnum = {
  FREE: 'free' as LicenseTier,
  TRIAL: 'trial' as LicenseTier,
  MONTHLY: 'monthly' as LicenseTier,
  LIFETIME: 'lifetime' as LicenseTier,
  ADMIN: 'admin' as LicenseTier,
} as const

/** License 上下文（传给 Rule.run） */
export interface LicenseContext {
  tier: LicenseTier
  expiresAt?: Date
}

/** 日志接口（不依赖任何日志库，由 SDK 使用者注入） */
export interface RuleLogger {
  debug(msg: string, data?: unknown): void
  info(msg: string, data?: unknown): void
  warn(msg: string, data?: unknown): void
  error(msg: string, data?: unknown): void
}

/** Rule 执行上下文 */
export interface RuleContext {
  /** AbortSignal，用户取消搜索时触发 */
  signal: AbortSignal
  /** 当前用户 license */
  license: LicenseContext
  /** 日志接口 */
  logger: RuleLogger
}

/** 单条搜索结果 */
export interface Hit {
  /** 结果标题 */
  title: string
  /** 结果 URL（去重主键） */
  url: string
  /** 摘要（可选） */
  snippet?: string
  /** 来源站名（可选） */
  source?: string
  /** 元数据（可选） */
  meta?: Record<string, unknown>
}

/** Rule 接口 - 每条规则必须实现 */
export interface Rule {
  /** 唯一标识（npm 包名风格，如 @seekall/rule-arxiv） */
  name: string
  /** 语义化版本 */
  version: string
  /** 风险评级 L0-L4 */
  riskLevel: RiskLevel
  /** 简短描述 */
  description: string
  /** 执行函数 - 在用户机器上跑，返回 Hit 数组 */
  run(query: string, ctx: RuleContext): Promise<Hit[]>
}

/** 引擎配置 */
export interface EngineOptions {
  /** 规则数组 */
  rules: Rule[]
  /** 并发执行规则数（默认 5） */
  concurrency?: number
  /** 单条规则超时毫秒（默认 10000） */
  timeoutMs?: number
  /** 注入的 license context（默认 free） */
  license?: LicenseContext
  /** 注入的 logger（默认 console） */
  logger?: RuleLogger
}

/** 引擎 search 方法选项 */
export interface EngineSearchOptions {
  /** AbortSignal，取消搜索 */
  signal?: AbortSignal
  /** 流式回调，每条规则完成时调用 */
  onHit?: (hit: Hit, ruleName: string) => void
}

/** 搜索引擎实例 */
export interface Engine {
  /** 搜索 - 汇总所有规则的 Hit，按 url 去重 */
  search(query: string, options?: EngineSearchOptions): Promise<Hit[]>
  /** 运行时添加规则 */
  addRule(rule: Rule): void
  /** 运行时删除规则 */
  removeRule(ruleName: string): boolean
  /** 列出当前已加载的规则（仅元数据） */
  listRules(): Array<{ name: string; version: string; riskLevel: RiskLevel; description: string }>
}
