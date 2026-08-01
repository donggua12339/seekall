/**
 * 极简 HTTP CONNECT 代理 — 给 SeekAll greenhub 做大陆中转
 *
 * 部署在大陆 VPS 上，让 HK 服务器能访问被墙/超时的国内站。
 * 仅允许来自 SeekAll HK IP 的连接（安全）。
 *
 * 启动：node http-proxy.mjs
 * 端口：8888（可通过 PORT 环境变量修改）
 */

import http from 'node:http'
import https from 'node:https'
import net from 'node:net'

const PORT = parseInt(process.env.PROXY_PORT || '8888', 10)

// 允许的客户端 IP（SeekAll HK 服务器）
// 留空表示不限制（开发/测试用）
const ALLOWED_IPS = process.env.ALLOWED_IPS
  ? process.env.ALLOWED_IPS.split(',').map((s) => s.trim())
  : []

function isAllowed(clientIp) {
  if (ALLOWED_IPS.length === 0) return true
  // 去掉 IPv6 映射前缀
  const ip = clientIp.replace(/^::ffff:/, '')
  return ALLOWED_IPS.includes(ip) || ip === '127.0.0.1'
}

const server = http.createServer((req, res) => {
  if (!isAllowed(req.socket.remoteAddress)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  // 普通 HTTP 请求代理
  try {
    const target = new URL(req.url)
    const mod = target.protocol === 'https:' ? https : http
    const headers = { ...req.headers, host: target.host }
    delete headers['proxy-connection']

    const proxyReq = mod.request(
      target,
      { method: req.method, headers },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers)
        proxyRes.pipe(res)
      },
    )
    proxyReq.on('error', () => {
      if (!res.headersSent) res.writeHead(502)
      res.end()
    })
    req.pipe(proxyReq)
  } catch {
    if (!res.headersSent) res.writeHead(400)
    res.end()
  }
})

// HTTPS CONNECT 隧道
server.on('connect', (req, clientSocket, head) => {
  if (!isAllowed(req.socket.remoteAddress)) {
    clientSocket.write('HTTP/1.1 403 Forbidden\r\n\r\n')
    clientSocket.end()
    return
  }

  const [host, portStr] = req.url.split(':')
  const port = parseInt(portStr) || 443

  const serverSocket = net.connect(port, host, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    if (head.length) serverSocket.write(head)
    serverSocket.pipe(clientSocket)
    clientSocket.pipe(serverSocket)
  })

  serverSocket.on('error', () => {
    try {
      clientSocket.write('HTTP/1.1 502 Bad Gateway\r\n\r\n')
    } catch { /* ignore */ }
    clientSocket.end()
  })

  clientSocket.on('error', () => serverSocket.end())

  serverSocket.setTimeout(30000, () => {
    serverSocket.end()
    clientSocket.end()
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[http-proxy] listening on :${PORT}`)
  if (ALLOWED_IPS.length > 0) {
    console.log(`[http-proxy] allowed IPs: ${ALLOWED_IPS.join(', ')}`)
  } else {
    console.log('[http-proxy] WARNING: no IP restriction set')
  }
})
