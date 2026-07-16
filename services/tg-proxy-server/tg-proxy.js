/**
 * TG API 反向代理（极简版，部署在香港服务器）
 *
 * 用法：
 *   1. 把本文件上传到香港服务器
 *   2. 安装 Node.js 18+
 *   3. 运行：node tg-proxy.js
 *   4. 后端 .env 配置 TG_API_BASE=http://<香港服务器IP>:8787
 *
 * 可选：用 PM2 守护
 *   pm2 start tg-proxy.js --name tg-proxy
 *   pm2 save && pm2 startup
 *
 * 安全：本脚本不设访问密钥，建议：
 *   - 只开放 8787 端口给本机（防火墙限制源 IP）
 *   - 或加 SECRET_TOKEN 校验（见注释）
 */

const http = require('http')
const https = require('https')

const PORT = process.env.PORT || 8787
// 可选：设置访问密钥（取消注释并在后端请求头加 X-Proxy-Token）
// const SECRET_TOKEN = 'your-secret-token'

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', '*')

  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // 健康检查
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', service: 'tg-proxy', time: new Date().toISOString() }))
    return
  }

  // 可选：密钥校验
  // if (SECRET_TOKEN && req.headers['x-proxy-token'] !== SECRET_TOKEN) {
  //   res.writeHead(401)
  //   res.end('Unauthorized')
  //   return
  // }

  // 转发到 Telegram API
  const targetUrl = `https://api.telegram.org${req.url}`
  const headers = { ...req.headers }
  delete headers['x-proxy-token']
  delete headers['host']
  headers['host'] = 'api.telegram.org'

  const proxyReq = https.request(targetUrl, {
    method: req.method,
    headers,
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    proxyRes.pipe(res)
  })

  proxyReq.on('error', (err) => {
    console.error(`[TG-Proxy] Error: ${err.message}`)
    res.writeHead(502, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: err.message }))
  })

  req.pipe(proxyReq)
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[TG-Proxy] Listening on http://0.0.0.0:${PORT}`)
  console.log(`[TG-Proxy] Forwarding to https://api.telegram.org`)
  console.log(`[TG-Proxy] Health: http://localhost:${PORT}/health`)
})

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n[TG-Proxy] Shutting down...')
  server.close(() => process.exit(0))
})
process.on('SIGTERM', () => {
  server.close(() => process.exit(0))
})
