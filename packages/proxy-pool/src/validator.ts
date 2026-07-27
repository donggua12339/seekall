import { fetch, ProxyAgent } from 'undici'
import type { ProxyEntry, ProxyRegion } from './types.js'

// 可达性探针：用"能不能访问目标"反推出口区域，绕开限流的 geo-IP 服务。
// google 在大陆出口被墙 → 能访问 google = 海外出口；只通百度 = 大陆出口。
const CN_PROBE = 'http://www.baidu.com'
const FOREIGN_PROBE = 'http://www.google.com/generate_204'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

/** 硬超时兜底：无论 promise 是否挂死，到点必返回 fallback。防止个别代理拖死整个 worker 池。 */
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), ms)
    p.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      () => {
        clearTimeout(timer)
        resolve(fallback)
      },
    )
  })
}

interface ProbeResult {
  ok: boolean
  latencyMs: number
}

async function probe(
  dispatcher: ProxyAgent,
  target: string,
  timeoutMs: number,
): Promise<ProbeResult> {
  const start = Date.now()
  try {
    const res = await fetch(target, {
      dispatcher,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'manual',
      headers: { 'User-Agent': UA },
    })
    const latencyMs = Date.now() - start
    // 不下载 body（百度返回大 HTML），拿到状态码即视为连通
    await res.body?.cancel().catch(() => {})
    return { ok: res.status > 0, latencyMs }
  } catch {
    return { ok: false, latencyMs: Date.now() - start }
  }
}

/**
 * 验证单个代理：并行探测大陆/海外可达性，判定区域 + 延迟。
 * 两者都不通 → 返回 null（废代理）。
 */
async function validateOne(
  entry: ProxyEntry,
  timeoutMs: number,
): Promise<ProxyEntry | null> {
  const proxyUrl = `http://${entry.host}:${entry.port}`
  const dispatcher = new ProxyAgent({ uri: proxyUrl, connectTimeout: timeoutMs })
  try {
    const [cn, foreign] = await Promise.all([
      probe(dispatcher, CN_PROBE, timeoutMs),
      probe(dispatcher, FOREIGN_PROBE, timeoutMs),
    ])

    let region: ProxyRegion
    let latencyMs: number
    if (foreign.ok) {
      // 能访问 google = 非大陆出口（海外）
      region = 'foreign'
      latencyMs = foreign.latencyMs
    } else if (cn.ok) {
      region = 'cn'
      latencyMs = cn.latencyMs
    } else {
      return null
    }

    return { ...entry, region, latencyMs, lastTested: Date.now(), fails: 0 }
  } finally {
    // close 也可能挂（活动 socket），加硬超时
    await withTimeout(dispatcher.close().catch(() => {}), 2000, undefined)
  }
}

export interface ValidateOptions {
  concurrency?: number
  timeoutMs?: number
  logger?: (msg: string) => void
}

/**
 * 并发验证全部候选，返回可用代理（已打区域标 + 延迟）。
 * worker 池模型，避免一次性上千连接。
 */
export async function validateAll(
  candidates: ProxyEntry[],
  opts: ValidateOptions = {},
): Promise<ProxyEntry[]> {
  const concurrency = opts.concurrency ?? 50
  const timeoutMs = opts.timeoutMs ?? 6000
  const log = opts.logger || (() => {})

  const results: ProxyEntry[] = []
  const queue = [...candidates]
  let done = 0

  // 硬上限：单个代理最多占用 worker 这么久（探针超时 + close + 余量），到点强制放行
  const hardTimeoutMs = timeoutMs + 4000

  const workers = Array.from({ length: concurrency }, async () => {
    while (queue.length > 0) {
      const entry = queue.shift()
      if (!entry) break
      const validated = await withTimeout(validateOne(entry, timeoutMs), hardTimeoutMs, null)
      if (validated) results.push(validated)
      done++
      if (done % 100 === 0 || done === candidates.length) {
        log(`[validate] ${done}/${candidates.length}，当前通过 ${results.length}`)
      }
    }
  })

  await Promise.all(workers)
  log(`[validate] 完成：${results.length}/${candidates.length} 可用`)
  return results
}
