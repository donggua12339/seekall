// 冒烟测试：取少量候选验证 fetch+validate 机制
import { fetchCandidates, validateAll, qualityFilter } from './dist/index.js'

const log = (m) => console.log(m)

console.log('=== 拉取候选 ===')
const candidates = await fetchCandidates(log)

// 各源混合取一个样本，限制总量便于快速验证
const sample = candidates.slice(0, 60)
console.log(`\n=== 测速验证 ${sample.length} 个候选 ===`)
const t0 = Date.now()
const validated = await validateAll(sample, { concurrency: 30, timeoutMs: 5000, logger: log })
console.log(`耗时 ${((Date.now() - t0) / 1000).toFixed(1)}s`)

const good = qualityFilter(validated, { maxLatencyMs: 4000 })
console.log(`\n=== 结果 ===`)
console.log(`可用 ${validated.length}/${sample.length}，优质 ${good.length}`)
const byRegion = {}
for (const e of good) byRegion[e.region] = (byRegion[e.region] || 0) + 1
console.log('区域分布:', byRegion)
console.log('\n前 10 个优质代理:')
for (const e of good.slice(0, 10)) {
  console.log(`  [${e.region}] ${e.host}:${e.port} ${e.latencyMs}ms (${e.source})`)
}
