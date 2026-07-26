/**
 * 冒烟测试 - 验证 greenhub 规则能正常搜索
 * 用法: node test-smoke.mjs [关键词]
 */
import greenhub from './dist/index.js'

const query = process.argv[2] || 'Everything 搜索工具'

const ctx = {
  signal: AbortSignal.timeout(15_000),
  license: { tier: 'admin' },
  logger: {
    debug: (msg) => console.debug(`[DBG] ${msg}`),
    info: (msg) => console.info(`[INF] ${msg}`),
    warn: (msg) => console.warn(`[WRN] ${msg}`),
    error: (msg) => console.error(`[ERR] ${msg}`),
  },
}

console.log(`\n🔍 搜索: "${query}"\n`)
const start = Date.now()

try {
  const hits = await greenhub.run(query, ctx)
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)

  console.log(`\n✅ ${hits.length} 条结果 (${elapsed}s)\n`)

  // 按 source 分组统计
  const bySource = {}
  for (const h of hits) {
    bySource[h.source] = (bySource[h.source] || 0) + 1
  }
  console.log('📊 各源命中:')
  for (const [src, count] of Object.entries(bySource)) {
    console.log(`   ${src}: ${count} 条`)
  }

  console.log('\n📋 前 10 条结果:')
  for (const h of hits.slice(0, 10)) {
    console.log(`   [${h.source}] ${h.title}`)
    console.log(`    ${h.url}`)
    if (h.snippet) console.log(`    ${h.snippet.slice(0, 80)}...`)
    console.log()
  }
} catch (err) {
  console.error('❌ 搜索失败:', err)
  process.exit(1)
}
