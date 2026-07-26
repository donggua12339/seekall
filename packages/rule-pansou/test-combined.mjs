/**
 * 集成测试 - 模拟 API search.service 的多规则并行 + 去重
 * 用法: node test-combined.mjs [关键词]
 */
process.env.PUPPETEER_EXECUTABLE_PATH ||=
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const greenhub = (await import('../rule-greenhub/dist/index.js')).default
const pansou = (await import('./dist/index.js')).default

const query = process.argv[2] || 'Photoshop'
const mkCtx = (ms) => ({
  signal: AbortSignal.timeout(ms),
  license: { tier: 'admin' },
  logger: {
    debug: () => {},
    info: (m) => console.info(`[INF] ${m}`),
    warn: (m) => console.warn(`[WRN] ${m}`),
    error: (m) => console.error(`[ERR] ${m}`),
  },
})

console.log(`\n🔍 集成搜索(含网盘): "${query}"\n`)
const start = Date.now()

// 并行跑两个规则（模拟 Promise.allSettled）
const settled = await Promise.allSettled([
  greenhub.run(query, mkCtx(20_000)),
  pansou.run(query, mkCtx(60_000)),
])

const results = []
for (const s of settled) if (s.status === 'fulfilled') results.push(...s.value)

// 去重（同 service 逻辑）
const seen = new Set()
const deduped = results.filter((h) => {
  const k = h.url.replace(/\/$/, '')
  if (seen.has(k)) return false
  seen.add(k)
  return true
})

const elapsed = ((Date.now() - start) / 1000).toFixed(1)
console.log(`\n✅ 合并去重后 ${deduped.length} 条 (原始 ${results.length}) (${elapsed}s)\n`)

// 按分类统计
const byCat = {}
for (const h of deduped) {
  const c = h.meta?.category || 'general'
  byCat[c] = (byCat[c] || 0) + 1
}
console.log('📊 分类统计:', byCat)
console.log('\n📋 网盘(pan)结果:')
for (const h of deduped.filter((h) => h.meta?.category === 'pan').slice(0, 8)) {
  console.log(`   [${h.source}] ${h.title.slice(0, 60)}`)
  console.log(`    ${h.url}`)
}
