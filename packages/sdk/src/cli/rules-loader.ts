/**
 * SeekAll CLI 规则加载器
 *
 * 动态 import 规则 npm 包,返回 Rule 实例
 */

import type { Rule } from '../types.js'

/** 内置规则映射(已发布的 @seekall/rule-* 包) */
const BUILTIN_RULES: Record<string, () => Promise<{ default: Rule }>> = {
  '@seekall/rule-arxiv': () => import('@seekall/rule-arxiv'),
  '@seekall/rule-crossref': () => import('@seekall/rule-crossref'),
  '@seekall/rule-pubmed': () => import('@seekall/rule-pubmed'),
  '@seekall/rule-github': () => import('@seekall/rule-github'),
  '@seekall/rule-hackernews': () => import('@seekall/rule-hackernews'),
}

/** 加载单个规则(优先内置映射,fallback 动态 import) */
export async function loadRule(npmPackage: string): Promise<Rule> {
  // 内置规则
  if (BUILTIN_RULES[npmPackage]) {
    const mod = await BUILTIN_RULES[npmPackage]()
    return mod.default
  }

  // 动态 import(用户自装的规则包)
  try {
    const mod = await import(npmPackage)
    if (mod.default && typeof mod.default.run === 'function') {
      return mod.default
    }
    throw new Error(`包 ${npmPackage} 没有 default export Rule`)
  } catch (err) {
    throw new Error(
      `加载规则 ${npmPackage} 失败: ${err instanceof Error ? err.message : String(err)}。请先 npm install ${npmPackage}`,
    )
  }
}

/** 批量加载规则 */
export async function loadRules(npmPackages: string[]): Promise<{
  rules: Rule[]
  failed: Array<{ name: string; error: string }>
}> {
  const rules: Rule[] = []
  const failed: Array<{ name: string; error: string }> = []

  for (const name of npmPackages) {
    try {
      const rule = await loadRule(name)
      rules.push(rule)
    } catch (err) {
      failed.push({
        name,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { rules, failed }
}

/** 列出所有可用的内置规则 */
export function listBuiltinRules(): string[] {
  return Object.keys(BUILTIN_RULES)
}
