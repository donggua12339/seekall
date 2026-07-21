/**
 * SeekAll SDK - 规则引擎
 *
 * 工作方式:
 *   const engine = createEngine({ rules: [...] })
 *   const hits = await engine.search('keyword')
 *
 * 默认 0 个规则。你需要自己写规则或从规则市场安装。
 * 这是合规设计,不是 bug。
 *
 * 性能差异化(tier-based):
 *   - free: 3 并发 + 10s 超时,无缓存
 *   - trial: 5 并发 + 8s 超时,无缓存
 *   - monthly: 10 并发 + 5s 超时,5min 缓存
 *   - lifetime: 20 并发 + 3s 超时,5min 缓存
 */

export type {
  Rule,
  Hit,
  RuleContext,
  Engine,
  EngineOptions,
  EngineSearchOptions,
  LicenseTier,
  RiskLevel,
  LicenseContext,
  RuleLogger,
} from './types.js'
export { createEngine } from './engine.js'
export { RiskLevelEnum, LicenseTierEnum, TIER_PERFORMANCE } from './types.js'
