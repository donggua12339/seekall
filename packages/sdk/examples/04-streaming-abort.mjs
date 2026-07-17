/**
 * Quickstart 4 - 流式回调 + 取消搜索
 *
 * 用 onHit 在每条规则完成时立即看到结果（不等所有规则跑完）。
 * 用 AbortSignal 在用户取消时立刻中断。
 */

import { createEngine } from '../dist/index.js'
import arxiv from '../../rule-arxiv/dist/index.js'
import crossref from '../../rule-crossref/dist/index.js'

const engine = createEngine({ rules: [arxiv, crossref] })

const ctrl = new AbortController()

// 5 秒后强制取消（演示，实际可由用户按键触发）
setTimeout(() => {
  console.log('\n[user] aborting search...')
  ctrl.abort()
}, 5000)

const hits = await engine.search('machine learning', {
  signal: ctrl.signal,
  onHit: (hit, ruleName) => {
    console.log(`[${ruleName}] ${hit.title.slice(0, 70)}`)
  },
})

console.log(`\nreceived ${hits.length} hits before completion/abort`)
