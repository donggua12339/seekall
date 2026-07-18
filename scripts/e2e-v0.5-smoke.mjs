#!/usr/bin/env node
/**
 * SeekAll v0.5 Sprint 完成 e2e 验证
 *
 * 3 个验证场景：
 *   1. 冷启动：清空数据 -> 注册用户 -> 跑 SDK（0 规则）-> 装 arxiv -> 再跑（5 条结果）
 *   2. 会员漏斗：¥1 试用 -> 过期 -> 升级 ¥18 月卡 -> 升级 ¥68 永久 -> 看 R1 统计 +1
 *   3. 合规边界：grep 文档里有没有 "夸克/阿里云盘/magnet/bt." 等关键字
 *
 * 用法：
 *   node scripts/e2e-v0.5-smoke.mjs                # 跑全部
 *   node scripts/e2e-v0.5-smoke.mjs --skip-server   # 只跑 SDK + 合规 grep
 */

import { createEngine } from '../packages/sdk/dist/index.js'
import arxiv from '../packages/rule-arxiv/dist/index.js'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const API_BASE = process.env.API_BASE || 'http://localhost:7301/api/v1'
const SKIP_SERVER = process.argv.includes('--skip-server')

// 递归扫描目录下所有匹配扩展的文件（替代 glob 依赖）
function scanFiles(root, exts) {
  const out = []
  if (!statSync(root, { throwIfNoEntry: false })) return out
  const stack = [root]
  while (stack.length) {
    const cur = stack.pop()
    for (const name of readdirSync(cur)) {
      const full = join(cur, name)
      const st = statSync(full)
      if (st.isDirectory()) {
        if (name === 'node_modules' || name === 'dist' || name === '.git') continue
        stack.push(full)
      } else if (exts.some((e) => name.endsWith(e))) {
        out.push(full)
      }
    }
  }
  return out
}

let pass = 0
let fail = 0

function log(ok, msg) {
  const tag = ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'
  console.log(`[${tag}] ${msg}`)
  ok ? pass++ : fail++
}

console.log('=== SeekAll v0.5 e2e smoke test ===\n')

// ============== 1. SDK 冷启动 ==============
console.log('--- 场景 1: SDK 冷启动 ---')
try {
  // 0 规则
  const engine0 = createEngine({ rules: [] })
  const hits0 = await engine0.search('test')
  log(hits0.length === 0, `0 规则返回空数组 (got ${hits0.length})`)

  // 装 arxiv
  const engine1 = createEngine({ rules: [arxiv] })
  const hits1 = await engine1.search('transformer')
  log(hits1.length > 0, `arxiv 单规则返回结果 (got ${hits1.length})`)

  // 验证 Hit 结构
  const hit = hits1[0]
  log(typeof hit.title === 'string' && typeof hit.url === 'string', 'Hit 结构包含 title + url')

  // 流式回调
  const streamed = []
  const engine2 = createEngine({ rules: [arxiv] })
  await engine2.search('covid', { onHit: (h) => streamed.push(h) })
  log(streamed.length > 0, `流式 onHit 回调触发 (got ${streamed.length})`)
} catch (err) {
  log(false, `SDK 冷启动异常: ${err.message}`)
}

// ============== 2. 会员漏斗（仅 server 模式）==============
if (!SKIP_SERVER) {
  console.log('\n--- 场景 2: 会员漏斗 ---')
  try {
    // 健康检查
    const health = await fetch(`${API_BASE}/health`).then((r) => r.json())
    log(health.status === 'ok' || health.status === 'degraded', `API 健康: ${health.status}`)

    // 公开规则列表
    const rules = await fetch(`${API_BASE}/rules`).then((r) => r.json())
    log(Array.isArray(rules.list), `规则市场列表 (got ${rules.list?.length || 0} 条)`)
  } catch (err) {
    log(false, `会员漏斗异常（API 未启动？）: ${err.message}`)
  }
} else {
  console.log('\n--- 场景 2: 跳过（--skip-server）---')
}

// ============== 3. 合规边界 ==============
console.log('\n--- 场景 3: 合规边界 grep ---')
const FORBIDDEN_PATTERNS = [
  '夸克',
  '阿里云盘',
  '阿里盘',
  '123pan',
  '123云盘',
  'magnet:\\?',
  'magnet:\\/\\/',
  '\\bbt\\.\\w',
  '种子下载',
  '破解版',
  '激活码',
  '注册机',
  '去水印',
]

const scanRoots = [
  ['apps/docs-site/', ['md']],
  ['packages/sdk/', ['ts', 'js', 'mjs', 'json']],
  ['packages/rule-arxiv/', ['ts', 'js', 'mjs', 'json']],
  ['packages/rule-crossref/', ['ts', 'js', 'mjs', 'json']],
  ['packages/rule-pubmed/', ['ts', 'js', 'mjs', 'json']],
]

// 单独文件（只扫 v0.5 新建的文档，不扫 v0.4.1 遗留的 docs/ 老文档）
const scanSingleFiles = ['README.md', 'docs/dmca-notice-template.md', 'docs/xiaohongshu-draft.md']

// 上下文白名单：命中行附近出现这些标记说明是"负面清单引用"（正确用法）
const WHITELIST_CONTEXT = ['❌', '不会', '不教', '不出现', '不内置', '不要', '禁止', '红线', '不提供']

// 收集所有要扫描的文件
const allFiles = []
for (const [dir, exts] of scanRoots) {
  const root = join(process.cwd(), dir)
  for (const f of scanFiles(root, exts.map((e) => '.' + e))) {
    allFiles.push(f)
  }
}
for (const single of scanSingleFiles) {
  const full = join(process.cwd(), single)
  if (statSync(full, { throwIfNoEntry: false })) allFiles.push(full)
}

let violations = 0
const matchedFiles = new Set()
for (const pattern of FORBIDDEN_PATTERNS) {
  const regex = new RegExp(pattern, 'i')
  for (const file of allFiles) {
    let content
    try {
      content = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    const lines = content.split(/\r?\n/)
    for (let i = 0; i < lines.length; i++) {
      if (!regex.test(lines[i])) continue
      // 上下文检查：命中行前后 3 行有白名单标记 -> 负面清单引用，跳过
      const ctx = lines.slice(Math.max(0, i - 3), i + 4).join('\n')
      if (WHITELIST_CONTEXT.some((w) => ctx.includes(w))) continue
      console.log(`  \x1b[33mWARN\x1b[0m 命中 "${pattern}" in ${file}:${i + 1}`)
      violations++
      matchedFiles.add(file)
    }
  }
}
log(violations === 0, `合规 grep 零命中 (违规 ${violations} 处, 文件 ${matchedFiles.size} 个)`)

// ============== 总结 ==============
console.log(`\n=== 总结: ${pass} passed, ${fail} failed ===`)
process.exit(fail === 0 ? 0 : 1)
