/**
 * SeekAll SDK - 规则引擎
 *
 * 工作方式：
 *   const engine = createEngine({ rules: [...] })
 *   const hits = await engine.search('keyword')
 *
 * 默认 0 个规则。你需要自己写规则或从规则市场安装。
 * 这是合规设计，不是 bug。
 */

export type { Rule, Hit, RuleContext, Engine, EngineOptions, EngineSearchOptions, LicenseTier, RiskLevel, } from './types.js'
export { createEngine } from './engine.js'
export { RiskLevelEnum, LicenseTierEnum } from './types.js'
