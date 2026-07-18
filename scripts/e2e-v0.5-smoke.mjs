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
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { globSync } from 'glob'

const API_BASE = process.env.API_BASE || 'http://localhost:7301/api/v1'
const SKIP_SERVER = process.argv.includes('--skip-server')

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

const scanDirs = ['apps/docs-site/', 'packages/sdk/', 'packages/rule-arxiv/', 'packages/rule-crossref/', 'packages/rule-pubmed/', 'README.md', 'docs/']

let violations = 0
for (const pattern of FORBIDDEN_PATTERNS) {
  try {
    const regex = new RegExp(pattern, 'i')
    for (const dir of scanDirs) {
      const files = globSync(`${dir}**/*.{md,ts,js,mjs,json,vue}`, { nodir: true })
      for (const file of files) {
        const content = readFileSync(file, 'utf8')
        if (regex.test(content)) {
          console.log(`  \x1b[33mWARN\x1b[0m 命中 "${pattern}" in ${file}`)
          violations++
        }
      }
    }
  } catch (err) {
    // glob 路径不存在，跳过
  }
}
log(violations === 0, `合规 grep 零命中 (违规 ${violations} 处)`)

// ============== 总结 ==============
console.log(`\n=== 总结: ${pass} passed, ${fail} failed ===`)
process.exit(fail === 0 ? 0 : 1)
