/**
 * Quickstart 2 - 单规则搜索
 *
 * 安装 1 个规则（arxiv），搜索学术文献。
 */

import { createEngine } from '../dist/index.js'
import arxiv from '../../rule-arxiv/dist/index.js'

const engine = createEngine({ rules: [arxiv] })

const hits = await engine.search('transformer attention')
console.log(`arxiv returned ${hits.length} hits`)
for (const h of hits.slice(0, 3)) {
  console.log(`  - ${h.title}`)
  console.log(`    ${h.url}`)
}
