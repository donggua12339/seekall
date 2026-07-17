// Smoke test - 直接 import workspace 包的 dist 产物（避免 pnpm symlink 问题）
import { createEngine } from '../dist/index.js'
import arxiv from '../../rule-arxiv/dist/index.js'
import crossref from '../../rule-crossref/dist/index.js'
import pubmed from '../../rule-pubmed/dist/index.js'

const engine = createEngine({
  rules: [arxiv, crossref, pubmed],
  concurrency: 3,
  timeoutMs: 15000,
})

console.log('Loaded rules:', engine.listRules().map((r) => r.name))

const query = process.argv[2] || 'covid vaccine mrna'
console.log(`\nSearching: "${query}"\n`)

const hits = await engine.search(query, {
  onHit: (hit, ruleName) => {
    console.log(`  [${ruleName}] ${hit.title.slice(0, 80)}`)
  },
})

console.log(`\nTotal unique hits: ${hits.length}`)
console.log('\nFirst 3 hits (deduped):')
for (const h of hits.slice(0, 3)) {
  console.log(`  - ${h.title}`)
  console.log(`    ${h.url}`)
  console.log(`    source: ${h.source}, meta.sources: ${JSON.stringify(h.meta?.sources)}`)
}
