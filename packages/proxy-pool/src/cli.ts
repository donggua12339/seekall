#!/usr/bin/env node
import { refresh } from './index.js'

interface ParsedArgs {
  _: string[]
  flags: Record<string, string>
}

function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { _: [], flags: {} }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = argv[i + 1]
      const val = next && !next.startsWith('--') ? ((i++, next)) : 'true'
      out.flags[key] = val
    } else {
      out._.push(a)
    }
  }
  return out
}

function num(v: string | undefined, fallback: number): number {
  if (!v) return fallback
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : fallback
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const cmd = args._[0]

  if (cmd === 'refresh') {
    const result = await refresh({
      validate: {
        concurrency: num(args.flags.concurrency, 50),
        timeoutMs: num(args.flags.timeout, 6000),
      },
      quality: {
        maxLatencyMs: num(args.flags['max-latency'], 3000),
        maxPerRegion: num(args.flags['max-per-region'], 60),
        maxTotal: num(args.flags['max-total'], 150),
      },
      file: args.flags.file,
      logger: (m) => console.log(m),
    })
    console.log('\n=== 代理池刷新结果 ===')
    console.log(JSON.stringify(result.stats, null, 2))
  } else {
    console.log('用法: proxy-pool refresh [--concurrency 50] [--timeout 6000] [--max-latency 3000] [--file path]')
    console.log('  refresh   拉取免费代理 → 测速 → 筛选 → 存档')
  }
}

main().catch((err) => {
  console.error('执行失败:', err)
  process.exit(1)
})
