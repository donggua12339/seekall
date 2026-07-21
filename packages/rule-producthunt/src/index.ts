/**
 * @seekall/rule-producthunt - Product Hunt 产品搜索规则
 *
 * 风险评级: L2 付费独享(开发者热点)
 * 数据源: Product Hunt 官方公开页面(https://www.producthunt.com/search?q=xxx)
 *         - 不需登录,页面公开
 *         - 遵守 robots.txt
 *         - 通过 HTML 解析提取产品信息
 *
 * 注意: Product Hunt 有官方 GraphQL API,但需申请 token。
 *       本规则用公开页面 + HTML 解析,避免 token 门槛。
 *       如需更高频次,建议用户自己申请 API token 改造。
 *
 * 示例:
 * ```ts
 * import { createEngine } from '@seekall/sdk'
 * import producthunt from '@seekall/rule-producthunt'
 *
 * const engine = createEngine({ rules: [producthunt] })
 * const hits = await engine.search('ai writing')
 * ```
 */

import type { Rule, Hit, RuleContext } from '@seekall/sdk'

interface Product {
  name?: string
  tagline?: string
  url?: string
  votes?: number
  topics?: string[]
}

/** 简易 HTML 解析:从 Product Hunt 搜索页提取产品卡片 */
function parseProducts(html: string): Product[] {
  const products: Product[] = []

  // Product Hunt 搜索结果用 JSON-LD 或 data-attributes
  // 这里用通用正则提取 og:title / data-test 等模式
  // 由于 PH 页面结构可能变,优先解析 JSON-LD
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)
  if (jsonLdMatch) {
    for (const block of jsonLdMatch) {
      const json = block.match(/<script[^>]*>([\s\S]*?)<\/script>/)?.[1]
      if (!json) continue
      try {
        const data = JSON.parse(json)
        const items = Array.isArray(data) ? data : [data]
        for (const item of items) {
          if (item['@type'] === 'Product' || item.name) {
            products.push({
              name: item.name,
              tagline: item.description,
              url: item.url,
            })
          }
        }
      } catch {
        // 静默
      }
    }
  }

  // Fallback: 解析链接
  if (products.length === 0) {
    const linkRegex = /<a[^>]+href="(\/posts\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g
    let m: RegExpExecArray | null
    while ((m = linkRegex.exec(html)) !== null) {
      const url = `https://www.producthunt.com${m[1]}`
      const titleText = m[2].replace(/<[^>]+>/g, '').trim()
      if (titleText && titleText.length > 2) {
        products.push({
          name: titleText.slice(0, 100),
          url,
        })
      }
    }
  }

  return products
}

export const producthuntRule: Rule = {
  name: '@seekall/rule-producthunt',
  version: '0.5.0',
  riskLevel: 2,
  description: '搜索 Product Hunt 产品(L2 付费独享,开发者热点)',

  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    const url = `https://www.producthunt.com/search?q=${encodeURIComponent(query)}`
    ctx.logger.info(`producthunt: fetching ${url}`)

    const res = await fetch(url, {
      signal: ctx.signal,
      headers: {
        'User-Agent': 'SeekAll/0.5 (+https://github.com/donggua12339/seekall)',
        Accept: 'text/html',
      },
    })
    if (!res.ok) {
      throw new Error(`producthunt HTTP ${res.status}`)
    }

    const html = await res.text()
    const products = parseProducts(html)

    return products
      .filter((p) => p.name && p.url)
      .slice(0, 20)
      .map((p) => ({
        title: p.name!,
        url: p.url!,
        snippet: p.tagline?.slice(0, 280),
        source: 'producthunt.com',
        meta: {
          votes: p.votes,
          topics: p.topics && p.topics.length > 0 ? p.topics : undefined,
        },
      }))
  },
}

export default producthuntRule
