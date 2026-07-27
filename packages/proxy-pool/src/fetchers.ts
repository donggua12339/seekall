import { fetch } from 'undici'
import type { ProxyEntry, ProxyRegion } from './types.js'

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

const IP_PORT_RE = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})[:\s](\d{2,5})/

/** 从任意格式的一行里提取 ip:port（兼容 "http://ip:port"、"ip:port"、"ip port" 等） */
function parseLine(line: string): { host: string; port: number } | null {
  const m = line.match(IP_PORT_RE)
  if (!m) return null
  const port = parseInt(m[2], 10)
  if (!port || port < 1 || port > 65535) return null
  return { host: m[1], port }
}

async function fetchText(url: string, timeoutMs = 20_000): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'User-Agent': UA, Accept: 'text/plain,*/*' },
    redirect: 'follow',
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

function makeEntry(
  host: string,
  port: number,
  region: ProxyRegion,
  source: string,
  protocol: ProxyEntry['protocol'] = 'http',
): ProxyEntry {
  return {
    host,
    port,
    protocol,
    region,
    source,
    latencyMs: 0,
    lastTested: 0,
    fails: 0,
  }
}

interface RawSource {
  name: string
  url: string
  region: ProxyRegion
  max: number
  protocol?: ProxyEntry['protocol']
}

// 免费代理源清单。ProxyScrape 按国家拉取可直接打标；TheSpeedX/monosans 是大杂烩（unknown）。
const RAW_SOURCES: RawSource[] = [
  {
    name: 'thespeedx',
    url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    region: 'unknown',
    max: 400,
  },
  {
    name: 'monosans',
    url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
    region: 'unknown',
    max: 300,
  },
  {
    name: 'proxyscrape-cn',
    url: 'https://api.proxyscrape.com/v4/free-proxy-list/get?request=displayproxies&proxy_format=protocolipport&country=cn&timeout=8000',
    region: 'cn',
    max: 200,
  },
  {
    name: 'proxyscrape-us',
    url: 'https://api.proxyscrape.com/v4/free-proxy-list/get?request=displayproxies&proxy_format=protocolipport&country=us&timeout=8000',
    region: 'foreign',
    max: 120,
  },
  {
    name: 'proxyscrape-jp',
    url: 'https://api.proxyscrape.com/v4/free-proxy-list/get?request=displayproxies&proxy_format=protocolipport&country=jp&timeout=8000',
    region: 'foreign',
    max: 80,
  },
  {
    name: 'proxyscrape-sg',
    url: 'https://api.proxyscrape.com/v4/free-proxy-list/get?request=displayproxies&proxy_format=protocolipport&country=sg&timeout=8000',
    region: 'foreign',
    max: 80,
  },
  // iplocate（每 30 分钟更新，verified）
  {
    name: 'iplocate-http',
    url: 'https://raw.githubusercontent.com/iplocate/free-proxy-list/main/protocols/http.txt',
    region: 'unknown',
    max: 400,
  },
  {
    name: 'iplocate-all',
    url: 'https://raw.githubusercontent.com/iplocate/free-proxy-list/main/all-proxies.txt',
    region: 'unknown',
    max: 400,
  },
  // TheSpeedX SOCKS4（池子最大；socks 协议）
  {
    name: 'thespeedx-socks4',
    url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt',
    region: 'unknown',
    max: 500,
    protocol: 'socks4',
  },
]

/**
 * 从所有免费源拉取候选代理（未验证）。
 * 去重（host:port），每源限量。
 */
export async function fetchCandidates(
  logger?: (msg: string) => void,
): Promise<ProxyEntry[]> {
  const log = logger || (() => {})
  const seen = new Set<string>()
  const out: ProxyEntry[] = []

  await Promise.all(
    RAW_SOURCES.map(async (src) => {
      try {
        const text = await fetchText(src.url)
        const lines = text.split(/\r?\n/)
        let count = 0
        for (const line of lines) {
          if (count >= src.max) break
          const parsed = parseLine(line)
          if (!parsed) continue
          const key = `${parsed.host}:${parsed.port}`
          if (seen.has(key)) continue
          seen.add(key)
          out.push(makeEntry(parsed.host, parsed.port, src.region, src.name, src.protocol || 'http'))
          count++
        }
        log(`[fetch] ${src.name}: ${count} 候选`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        log(`[fetch] ${src.name} 失败: ${msg}`)
      }
    }),
  )

  log(`[fetch] 合计 ${out.length} 个去重候选`)
  return out
}
