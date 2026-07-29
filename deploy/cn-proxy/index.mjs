/**
 * SeekAll 大陆代理函数 — 阿里云函数计算 FC (HTTP 触发器)
 *
 * 用途：SeekAll HK 服务器调此函数 → 函数在大陆 fetch 目标站 → 返回 HTML
 * 解决：HK 直连国内网盘搜索站超时 / 被反爬的问题
 *
 * 部署步骤：
 * 1. 阿里云控制台 → 函数计算 FC → 创建服务 seekall
 * 2. 创建函数 cn-proxy，运行环境 Node.js 18+，请求处理程序类型选「处理 HTTP 请求」
 * 3. 把本文件内容粘贴到 index.mjs
 * 4. 配置 HTTP 触发器，认证方式选「匿名」（或 function 级别认证更安全）
 * 5. 记下触发器 URL，如 https://seekall-xxx.cn-hangzhou.fcapp.run
 * 6. 在 SeekAll HK 服务器 .env 加 CN_PROXY_URL=https://seekall-xxx.cn-hangzhou.fcapp.run
 * 7. 重启 seekall-api 容器
 *
 * 免费额度：每月 15 万 CU，pansou 每天 100 次搜索 × 2 源 = 月 6000 次，远低于免费额度
 */

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

// 允许代理的域名白名单（安全：防止被滥用为开放代理）
const ALLOWED_HOSTS = [
  'search.quark.cn',
  'www.upyunso.com',
  'www.alipansou.com',
  'www.pansou.com',
  'www.wodepan.com',
  'www.xunleisou.com',
  'www.tianyisou.com',
  'pan.baidu.com',
  'pan.quark.cn',
  'www.alipan.com',
  'www.123pan.com',
  'pan.xunlei.com',
  'cloud.189.cn',
]

function isAllowed(urlStr) {
  try {
    const u = new URL(urlStr)
    return ALLOWED_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h))
  } catch {
    return false
  }
}

/**
 * 阿里云 FC HTTP 触发器入口
 * 请求格式：GET /?url=<encoded_target_url>
 * 返回：目标站的 HTML 原文
 */
export const handler = async (request) => {
  const url = new URL(request.url)
  const targetUrl = url.searchParams.get('url')

  if (!targetUrl) {
    return new Response(JSON.stringify({ error: 'missing url param' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!isAllowed(targetUrl)) {
    return new Response(JSON.stringify({ error: 'host not allowed' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000) // 15s 超时

    const res = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': UA,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    })

    clearTimeout(timer)

    const html = await res.text()

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': `text/html; charset=utf-8`,
        'X-SeekAll-Proxy': 'cn-fc',
        'X-SeekAll-Status': String(res.status),
      },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || 'fetch failed' }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      },
    )
  }
}
