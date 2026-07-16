/**
 * Cloudflare Worker - Telegram Bot API 反向代理
 *
 * 部署步骤：
 *   1. 登录 https://dash.cloudflare.com -> Workers & Pages -> Create
 *   2. 创建 Worker，命名为 tg-api-proxy（或任意名）
 *   3. 把本文件内容粘贴到 Worker 编辑器
 *   4. 部署，获取 Worker URL（如 https://tg-api-proxy.your-name.workers.dev）
 *   5. 在 SeekAll .env 配置：
 *      TG_ALERT_BOT_TOKEN=<你的 bot token>
 *      TG_ALERT_CHAT_ID=<你的 chat_id>
 *      TG_API_BASE=https://tg-api-proxy.your-name.workers.dev
 *
 * 安全建议：
 *   - 在 Worker 中设置 SECRET_TOKEN，只允许带正确 token 的请求
 *   - 避免被滥用当作公开 TG API 代理
 *
 * 用法（与原生 TG API 完全兼容）：
 *   原生：https://api.telegram.org/bot<token>/sendMessage
 *   反代：https://<worker>.workers.dev/bot<token>/sendMessage
 */

// 可选：设置访问密钥（部署后在 Worker Settings -> Variables 添加 SECRET_TOKEN）
// const SECRET_TOKEN = 'your-secret-token-here'

export default {
  async fetch(request) {
    const url = new URL(request.url)

    // 可选：密钥校验
    // if (SECRET_TOKEN) {
    //   const auth = request.headers.get('X-Proxy-Token')
    //   if (auth !== SECRET_TOKEN) {
    //     return new Response('Unauthorized', { status: 401 })
    //   }
    // }

    // 健康检查
    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'tg-api-proxy' }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // 转发到 Telegram API
    const targetUrl = `https://api.telegram.org${url.pathname}${url.search}`
    const headers = new Headers(request.headers)
    headers.delete('X-Proxy-Token')
    headers.set('Host', 'api.telegram.org')

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      })

      // 透传响应
      const respHeaders = new Headers(response.headers)
      respHeaders.set('Access-Control-Allow-Origin', '*')
      respHeaders.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      respHeaders.set('Access-Control-Allow-Headers', '*')

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: respHeaders,
      })
    } catch (err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  },
}
