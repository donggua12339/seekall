/**
 * @seekall/rule-arxiv - arxiv.org 学术论文搜索规则
 *
 * 风险评级：L0 学术纯净
 * 数据源：arxiv.org 公开 API（http://export.arxiv.org/api/query）
 *
 * 示例：
 * ```ts
 * import { createEngine } from '@seekall/sdk'
 * import arxiv from '@seekall/rule-arxiv'
 *
 * const engine = createEngine({ rules: [arxiv] })
 * const hits = await engine.search('transformer attention')
 * ```
 */

import type { Rule, Hit, RuleContext } from '@seekall/sdk'

interface ArxivEntry {
  id?: string
  title?: string
  summary?: string
  link?: Array<{ href?: string }>
  author?: Array<{ name?: string }>
  published?: string
}

interface ArxivFeed {
  entry?: ArxivEntry | ArxivEntry[]
}

/** 简易 XML 解析（避免引入额外依赖，arxiv API 返回 Atom XML） */
function parseAtomXml(xml: string): ArxivFeed {
  const entries: ArxivEntry[] = []
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  let m: RegExpExecArray | null
  while ((m = entryRegex.exec(xml)) !== null) {
    const body = m[1]
    const title = body.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim()
    const summary = body.match(/<summary>([\s\S]*?)<\/summary>/)?.[1]?.trim()
    const id = body.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim()
    const linkMatch = body.match(/<link[^>]+href="([^"]+)"/)
    const published = body.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim()
    const authors: Array<{ name?: string }> = []
    const authorRegex = /<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g
    let a: RegExpExecArray | null
    while ((a = authorRegex.exec(body)) !== null) {
      authors.push({ name: a[1].trim() })
    }
    entries.push({
      id,
      title: title?.replace(/\s+/g, ' '),
      summary: summary?.replace(/\s+/g, ' '),
      link: linkMatch ? [{ href: linkMatch[1] }] : undefined,
      author: authors,
      published,
    })
  }
  return { entry: entries }
}

export const arxivRule: Rule = {
  name: '@seekall/rule-arxiv',
  version: '0.5.0',
  riskLevel: 0,
  description: '搜索 arxiv.org 学术论文（L0 学术纯净）',

  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=20`
    ctx.logger.info(`arxiv: fetching ${url}`)

    const res = await fetch(url, {
      signal: ctx.signal,
      headers: { 'User-Agent': 'SeekAll/0.5 (+https://github.com/donggua12339/seekall)' },
    })
    if (!res.ok) {
      throw new Error(`arxiv API ${res.status}`)
    }

    const xml = await res.text()
    const feed = parseAtomXml(xml)
    const entries = Array.isArray(feed.entry) ? feed.entry : feed.entry ? [feed.entry] : []

    return entries
      .filter((e) => e.title && (e.id || e.link?.[0]?.href))
      .map((e) => {
        const articleUrl = e.id || e.link?.[0]?.href || ''
        // arxiv id 从 URL 提取（http://arxiv.org/abs/2507.12345v1 -> 2507.12345v1）
        const arxivId = articleUrl.match(/\/abs\/([^/?#]+)$/)?.[1] || ''
        const authors = (e.author || []).map((a) => a.name).filter(Boolean).join(', ')

        return {
          title: e.title!,
          url: articleUrl,
          snippet: e.summary?.slice(0, 280),
          source: 'arxiv.org',
          meta: {
            arxivId,
            authors: authors || undefined,
            published: e.published || undefined,
          },
        }
      })
  },
}

export default arxivRule
