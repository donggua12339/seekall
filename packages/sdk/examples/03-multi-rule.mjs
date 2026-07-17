/**
 * Quickstart 3 - 多规则 + 去重
 *
 * 3 个学术规则并行跑，SDK 自动按 url 去重 + 合并 meta.sources。
 */

import { createEngine } from '../dist/index.js'
import arxiv from '../../rule-arxiv/dist/index.js'
import crossref from '../../rule-crossref/dist/index.js'
import pubmed from '../../rule-pubmed/dist/index.js'

const engine = createEngine({
  rules: [arxiv, crossref, pubmed],
  concurrency: 3,
  timeoutMs: 15000,
})

const hits = await engine.search('covid vaccine mrna')
console.log(`total: ${hits.length} unique hits`)

// 看是否有跨规则重复（meta.sources 长度 > 1）
const crossSource = hits.filter((h) => {
  const sources = h.meta?.sources
  return Array.isArray(sources) && sources.length > 1
})
console.log(`cross-source duplicates: ${crossSource.length}`)
