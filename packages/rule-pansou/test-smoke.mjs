/**
 * 冒烟测试 - 用本地 Edge 验证网盘搜索
 * 用法: node test-smoke.mjs [关键词]
 */
process.env.PUPPETEER_EXECUTABLE_PATH ||=
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

const { default: pansou } = await import('./dist/index.js')

const query = process.argv[2] || 'Photoshop'

const ctx = {
  signal: AbortSignal.timeout(60_000),
  license: { tier: 'admin' },
  logger: {
    debug: (m) => console.debug(`[DBG] ${m}`),
    info: (m) => console.info(`[INF] ${m}`),
    warn: (m) => console.warn(`[WRN] ${m}`),
    error: (m) => console.error(`[ERR] ${m}`),
  },
}

console.log(`\n🔍 网盘搜索: "${query}"\n`)
const start = Date.now()

try {
  const hits = await pansou.run(query, ctx)
  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\n✅ ${hits.length} 条结果 (${elapsed}s)\n`)

  const bySource = {}
  for (const h of hits) bySource[h.source] = (bySource[h.source] || 0) + 1
  console.log('📊 各源命中:')
  for (const [src, c] of Object.entries(bySource)) console.log(`   ${src}: ${c} 条`)

  console.log('\n📋 前 15 条:')
  for (const h of hits.slice(0, 15)) {
    console.log(`   [${h.source}] ${h.title}`)
    console.log(`    ${h.url}`)
  }
} catch (err) {
  console.error('❌ 搜索失败:', err)
  process.exit(1)
}
