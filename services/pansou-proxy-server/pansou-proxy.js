/**
 * PanSou API 反向代理（curl 子进程版）
 *
 * 用 curl 子进程转发请求，绕过 PanSou 对 Node.js fetch 的 TLS 指纹检测。
 *
 * 用法：
 *   node pansou-proxy.js
 *   pm2 start pansou-proxy.js --name pansou-proxy
 *
 * 后端 .env 配置：
 *   PANSOU_API_URLS=http://<REDACTED_SERVER_IP>:8788
 */

const http = require('http')
const { execFile } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const PORT = process.env.PANSOU_PROXY_PORT || 8788
const UPSTREAM = 'https://so.252035.xyz'

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'pansou-proxy', upstream: UPSTREAM }))
    return
  }

  const chunks = []
  req.on('data', (chunk) => chunks.push(chunk))
  req.on('end', () => {
    const body = Buffer.concat(chunks)
    const targetUrl = `${UPSTREAM}${req.url}`

    // 把 body 写入临时文件（避免 stdin 编码问题）
    const tmpFile = path.join(os.tmpdir(), `pansou-${Date.now()}.json`)
    fs.writeFileSync(tmpFile, body)

    const curlArgs = [
      '-sS',
      '--max-time', '20',
      '-X', req.method,
      '-H', 'Content-Type: application/json',
      '-H', 'Accept: application/json',
      '-d', `@${tmpFile}`,
      '-w', '\n__HTTP_CODE__:%{http_code}',
      targetUrl,
    ]

    const curl = execFile('curl', curlArgs, { timeout: 25000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      fs.unlink(tmpFile, () => {}) // 清理临时文件
      if (err) {
        console.error(`[Pansou-Proxy] curl error: ${err.message}`)
        res.writeHead(502, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: err.message }))
        return
      }

      const codeMatch = stdout.match(/\n__HTTP_CODE__:(\d+)$/)
      const httpCode = codeMatch ? codeMatch[1] : '200'
      const responseBody = codeMatch ? stdout.slice(0, codeMatch.index) : stdout

      res.writeHead(Number(httpCode), { 'Content-Type': 'application/json' })
      res.end(responseBody)
    })
  })
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Pansou-Proxy] Listening on http://0.0.0.0:${PORT}`)
  console.log(`[Pansou-Proxy] Forwarding to ${UPSTREAM} via curl`)
})

process.on('SIGINT', () => {
  console.log('\n[Pansou-Proxy] Shutting down...')
  server.close(() => process.exit(0))
})
