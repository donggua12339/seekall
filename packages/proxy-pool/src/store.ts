import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import type { ProxyEntry } from './types.js'

/** 代理池 JSON 路径：env PROXY_POOL_FILE 优先，默认 cwd/proxy-pool.json */
export function poolFilePath(): string {
  return resolve(process.env.PROXY_POOL_FILE || 'proxy-pool.json')
}

export async function savePool(entries: ProxyEntry[], file = poolFilePath()): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const payload = { updatedAt: Date.now(), count: entries.length, proxies: entries }
  await writeFile(file, JSON.stringify(payload, null, 2), 'utf-8')
}

export async function loadPool(file = poolFilePath()): Promise<ProxyEntry[]> {
  try {
    const raw = await readFile(file, 'utf-8')
    const parsed = JSON.parse(raw) as { proxies?: ProxyEntry[] }
    return Array.isArray(parsed.proxies) ? parsed.proxies : []
  } catch {
    return []
  }
}

export interface QualityOptions {
  /** 最大可接受延迟 ms */
  maxLatencyMs?: number
  /** 每个区域最多保留多少个 */
  maxPerRegion?: number
  /** 总上限 */
  maxTotal?: number
}

/**
 * 质量筛选：按延迟升序，剔除慢的，每区域限量。
 */
export function qualityFilter(entries: ProxyEntry[], opts: QualityOptions = {}): ProxyEntry[] {
  const maxLatencyMs = opts.maxLatencyMs ?? 3000
  const maxPerRegion = opts.maxPerRegion ?? 60
  const maxTotal = opts.maxTotal ?? 150

  const fast = entries.filter((e) => e.latencyMs > 0 && e.latencyMs <= maxLatencyMs)
  fast.sort((a, b) => a.latencyMs - b.latencyMs)

  const byRegion = new Map<string, ProxyEntry[]>()
  for (const e of fast) {
    const list = byRegion.get(e.region) || []
    if (list.length < maxPerRegion) list.push(e)
    byRegion.set(e.region, list)
  }

  const out: ProxyEntry[] = []
  for (const list of byRegion.values()) out.push(...list)
  out.sort((a, b) => a.latencyMs - b.latencyMs)
  return out.slice(0, maxTotal)
}
