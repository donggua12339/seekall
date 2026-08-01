/**
 * SeekAll 大陆代理微服务
 *
 * 部署在大陆 VPS 上（腾讯云 38元/年轻量 / 阿里云 ECS 等）
 * 接收搜索请求 → puppeteer 渲染国内网盘搜索站 → 返回结构化 JSON
 *
 * 启动：node server.mjs
 * 端口：8787（可通过 PORT 环境变量修改）
 *
 * HK 端 pansou 规则通过 CN_PANSOU_URL 环境变量调此服务
 */

import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import puppeteer from 'puppeteer-core'
import { existsSync } from 'node:fs'

const PORT = parseInt(process.env.PORT || '8787', 10)
const PAGE_TIMEOUT = 12_000

// ─── 浏览器路径探测 ─────────────────────────────────────────

function getExecutablePath() {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH
  if (envPath) return envPath
  const candidates = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  throw new Error('找不到 Chrome/Chromium/Edge')
}

// ─── 浏览器单例（常驻，避免每次 launch 的开销）─────────────

let browser = null

async function getBrowser() {
  if (browser && browser.isConnected()) return browser
  browser = await puppeteer.launch({
    executablePath: getExecutablePath(),
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote',
      '--single-process', // 低内存模式
    ],
  })
  return browser
}

// ─── 页面提取逻辑 ──────────────────────────────────────────

const EXTRACT_FN = `
(() => {
  const results = []
  const seen = new Set()

  function extractFileType(title) {
    if (/\\[文件夹\\]|\\[folder\\]|文件夹|📁|📂/i.test(title)) return 'folder'
    if (/\\[文件\\]|\\[file\\]|\\.zip|\\.rar|\\.7z|\\.exe|\\.apk|\\.iso|\\.dmg|\\.pdf|\\.epub|\\.mp4|\\.mkv/i.test(title)) return 'file'
    return 'unknown'
  }

  // 根据 URL 域名检测实际来源
  function detectSource(url) {
    try {
      const host = new URL(url).hostname.toLowerCase()
      const rules = [
        [/pan\.quark\.cn|quark\.cn|drive\.quark/i, '夸克网盘'],
        [/pan\.baidu\.com|yun\.baidu|wangpan\.baidu/i, '百度网盘'],
        [/alipan\.com|aliyundrive|drive\.aliyun/i, '阿里云盘'],
        [/115\.com/i, '115网盘'],
        [/pan\.xunlei|xunlei\.com/i, '迅雷云盘'],
        [/cloud\.189\.cn/i, '天翼云盘'],
        [/123pan\.com/i, '123云盘'],
        [/weiyun\.com|yun\.qq\.com/i, '腾讯微云'],
        [/pan\.360/i, '360云盘'],
        [/drive\.google/i, 'Google Drive'],
        [/onedrive\.live|sharepoint/i, 'OneDrive'],
        [/mega\.nz/i, 'MEGA'],
      ]
      for (const [re, label] of rules) {
        if (re.test(host) || re.test(url)) return label
      }
      return host.replace(/^www\./, '')
    } catch { return 'unknown' }
  }

  const cardSelectors = [
    '[class*="result"] [class*="item"]',
    '[class*="search"] [class*="item"]',
    '[class*="list"] > [class*="item"]',
    '[class*="card-item"]', '.result-item', '.search-item', '.list-item',
    'article',
  ].join(', ')

  document.querySelectorAll(cardSelectors).forEach(card => {
    const a = card.querySelector('a[href]')
    if (!a) return
    const href = a.href
    if (seen.has(href) || href === location.href) return
    const titleEl = card.querySelector('h2, h3, h4, .title, [class*="title"], [class*="name"]')
    const title = (titleEl || a).textContent.replace(/\\s+/g, ' ').trim().slice(0, 200)
    if (title.length < 2) return
    const snippetEl = card.querySelector('p, .desc, .summary, [class*="desc"], [class*="summary"], [class*="info"]')
    const snippet = snippetEl ? snippetEl.textContent.replace(/\\s+/g, ' ').trim().slice(0, 200) : ''
    seen.add(href)
    results.push({ title, url: href, snippet, fileType: extractFileType(title + ' ' + snippet), detectedSource: detectSource(href) })
  })

  const panRe = /pan\\.baidu|pan\\.quark|alipan|115\\.com|weiyun|123pan|pan\\.xunlei|drive\\.google|cloud\\.189|pan\\.360/i
  document.querySelectorAll('a[href]').forEach(a => {
    const href = a.href
    if (seen.has(href)) return
    if (panRe.test(href) || panRe.test(a.textContent || '')) {
      const title = a.textContent.replace(/\\s+/g, ' ').trim().slice(0, 200) || href
      if (title.length < 2) return
      seen.add(href)
      results.push({ title, url: href, snippet: '', fileType: extractFileType(title), detectedSource: detectSource(href) })
    }
  })

  return results.slice(0, 30)
})()
`

// ─── 搜索源定义 ──────────────────────────────────────────

const SOURCES = [
  {
    id: 'quark',
    label: '夸克搜索',
    buildUrl: (q) => `https://search.quark.cn/s?q=${encodeURIComponent(q)}`,
    waitSelector: '[class*="result"], [class*="card"], [class*="item"]',
  },
  {
    id: 'upyunso',
    label: 'UP云搜',
    buildUrl: (q) => `https://www.upyunso.com/search?q=${encodeURIComponent(q)}`,
    waitSelector: '[class*="result"], [class*="item"], [class*="card"]',
  },
]

async function searchSource(b, source, query) {
  let page = null
  try {
    page = await b.newPage()
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    )
    await page.setViewport({ width: 1280, height: 800 })

    const url = source.buildUrl(query)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: PAGE_TIMEOUT })

    try {
      await page.waitForSelector(source.waitSelector, { timeout: 6000 })
    } catch { /* continue */ }

    await new Promise((r) => setTimeout(r, 3000)) // CSR 渲染等待

    const raw = await page.evaluate(EXTRACT_FN)
    return {
      source: source.id,
      label: source.label,
      hits: raw.map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.snippet || undefined,
        source: r.detectedSource || source.label,
        meta: { category: 'pan', panSource: source.id, fileType: r.fileType || 'unknown', detectedSource: r.detectedSource || source.label },
      })),
    }
  } catch (err) {
    return { source: source.id, label: source.label, hits: [], error: err.message }
  } finally {
    if (page) try { await page.close() } catch {}
  }
}

// ─── HTTP 服务 ──────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const url = new URL(req.url, `http://localhost:${PORT}`)

  // 健康检查
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', browser: browser?.isConnected() ?? false }))
    return
  }

  // 搜索接口
  if (url.pathname === '/search') {
    const q = url.searchParams.get('q')
    if (!q) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'missing q param' }))
      return
    }

    const start = Date.now()
    try {
      const b = await getBrowser()
      // 并行搜索所有源
      const results = await Promise.allSettled(
        SOURCES.map((s) => searchSource(b, s, q)),
      )

      const allHits = []
      const sourceStats = []
      for (const r of results) {
        if (r.status === 'fulfilled') {
          allHits.push(...r.value.hits)
          sourceStats.push({ id: r.value.source, label: r.value.label, count: r.value.hits.length, error: r.value.error })
        }
      }

      // 去重
      const seen = new Set()
      const deduped = allHits.filter((h) => {
        const key = h.url.replace(/\/$/, '')
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        query: q,
        total: deduped.length,
        elapsedMs: Date.now() - start,
        sources: sourceStats,
        results: deduped,
      }))
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: err.message }))
    }
    return
  }

  // HTTP 正向代理（undici ProxyAgent 对 HTTP 目标发普通请求，req.url 是完整 URL）
  if (req.url.startsWith('http://') || req.url.startsWith('https://')) {
    try {
      const target = new URL(req.url)
      const mod = target.protocol === 'https:' ? https : http
      const headers = { ...req.headers, host: target.host }
      delete headers['proxy-connection']
      const proxyReq = mod.request(target, { method: req.method, headers }, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers)
        proxyRes.pipe(res)
      })
      proxyReq.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end() })
      req.pipe(proxyReq)
    } catch { if (!res.headersSent) res.writeHead(400); res.end() }
    return
  }

  res.writeHead(404)
  res.end('Not Found')
})

// HTTPS CONNECT 隧道（undici ProxyAgent 对 HTTPS 目标发 CONNECT）
server.on('connect', (req, clientSocket, head) => {
  const [host, portStr] = req.url.split(':')
  const port = parseInt(portStr) || 443
  const serverSocket = net.connect(port, host, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    if (head.length) serverSocket.write(head)
    serverSocket.pipe(clientSocket)
    clientSocket.pipe(serverSocket)
  })
  serverSocket.on('error', () => { try { clientSocket.end() } catch {} })
  clientSocket.on('error', () => { try { serverSocket.end() } catch {} })
  serverSocket.setTimeout(30000, () => { serverSocket.end(); clientSocket.end() })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[cn-proxy] listening on :${PORT} (pansou + HTTP proxy)`)
  console.log(`[cn-proxy] search: http://localhost:${PORT}/search?q=test`)
  console.log(`[cn-proxy] health: http://localhost:${PORT}/health`)
})

// 优雅关闭
process.on('SIGTERM', async () => {
  server.close()
  if (browser) await browser.close()
  process.exit(0)
})
