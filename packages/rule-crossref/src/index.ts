/**
 * @seekall/rule-crossref - crossref.org 文献元数据搜索规则
 *
 * 风险评级：L0 学术纯净
 * 数据源：crossref.org REST API（https://api.crossref.org/works）
 */

import type { Rule, Hit, RuleContext } from '@seekall/sdk'

interface CrossrefAuthor {
  given?: string
  family?: string
}

interface CrossrefMessageItem {
  DOI?: string
  title?: string[]
  author?: CrossrefAuthor[]
  'container-title'?: string[]
  published?: { 'date-parts'?: number[][] }
  abstract?: string
  URL?: string
}

interface CrossrefResponse {
  message?: {
    items?: CrossrefMessageItem[]
    'total-results'?: number
  }
}

function formatAuthors(authors: CrossrefAuthor[] = []): string {
  return authors
    .map((a) => [a.family, a.given].filter(Boolean).reverse().join(', '))
    .filter(Boolean)
    .join('; ')
}

function dateFromParts(parts?: number[][]): string | undefined {
  const p = parts?.[0]
  if (!p || p.length === 0) return undefined
  return p.map((n) => String(n).padStart(2, '0')).join('-')
}

export const crossrefRule: Rule = {
  name: '@seekall/rule-crossref',
  version: '0.5.0',
  riskLevel: 0,
  description: '搜索 crossref.org 文献元数据（L0 学术纯净）',

  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=20`
    ctx.logger.info(`crossref: fetching ${url}`)

    const res = await fetch(url, {
      signal: ctx.signal,
      headers: {
        'User-Agent': `SeekAll/0.5 (mailto:1660069758@qq.com)`,
      },
    })
    if (!res.ok) {
      throw new Error(`crossref API ${res.status}`)
    }

    const data = (await res.json()) as CrossrefResponse
    const items = data.message?.items ?? []

    return items
      .filter((it) => it.title?.[0] && (it.DOI || it.URL))
      .map((it) => {
        const doi = it.DOI || ''
        const articleUrl = it.URL || `https://doi.org/${doi}`
        return {
          title: it.title![0],
          url: articleUrl,
          snippet: it.abstract?.replace(/<[^>]+>/g, '').slice(0, 280),
          source: 'crossref.org',
          meta: {
            doi: doi || undefined,
            authors: formatAuthors(it.author) || undefined,
            container: it['container-title']?.[0],
            published: dateFromParts(it.published?.['date-parts']),
          },
        }
      })
  },
}

export default crossrefRule
