/**
 * @seekall/rule-arxiv-trending - arXiv 近期论文趋势规则
 *
 * 风险评级: L2 付费独享(学术增强)
 * 数据源: arXiv API (http://export.arxiv.org/api/query)
 *
 * 与 @seekall/rule-arxiv 的区别:
 *   - rule-arxiv: 全量搜索(L0 免费)
 *   - rule-arxiv-trending: 只返回最近 7 天 submitted 的论文(L2 付费)
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
    entries.push({ id, title, summary, link: linkMatch ? [{ href: linkMatch[1] }] : undefined, author: authors, published })
  }
  return { entry: entries }
}

export const arxivTrendingRule: Rule = {
  name: '@seekall/rule-arxiv-trending',
  version: '0.5.0',
  riskLevel: 2,
  description: '搜索 arXiv 近 7 天论文(L2 付费独享,学术趋势)',

  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    // submittedDate 过滤近 7 天
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const sinceStr = since.toISOString().replace(/[-:T]/g, '').slice(0, 8) + '000000'
    const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}+AND+submittedDate:[${sinceStr}+TO+*]&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending`
    ctx.logger.info(`arxiv-trending: fetching recent papers`)

    const res = await fetch(url, {
      signal: ctx.signal,
      headers: { 'User-Agent': 'SeekAll/0.5 (+https://github.com/donggua12339/seekall)' },
    })
    if (!res.ok) {
      throw new Error(`arxiv-trending API ${res.status}`)
    }

    const xml = await res.text()
    const feed = parseAtomXml(xml)
    const entries = Array.isArray(feed.entry) ? feed.entry : feed.entry ? [feed.entry] : []

    return entries
      .filter((e) => e.title && (e.id || e.link?.[0]?.href))
      .map((e) => {
        const articleUrl = e.id || e.link?.[0]?.href || ''
        const arxivId = articleUrl.match(/\/abs\/([^/?#]+)$/)?.[1] || ''
        const authors = (e.author || []).map((a) => a.name).filter(Boolean).join(', ')
        return {
          title: e.title!.replace(/\s+/g, ' '),
          url: articleUrl,
          snippet: e.summary?.replace(/\s+/g, ' ').slice(0, 280),
          source: 'arxiv.org/trending',
          meta: {
            arxivId,
            authors: authors || undefined,
            published: e.published || undefined,
          },
        }
      })
  },
}

export default arxivTrendingRule
