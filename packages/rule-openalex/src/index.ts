/**
 * @seekall/rule-openalex - OpenAlex 学术图谱搜索规则
 *
 * 风险评级: L2 付费独享(学术增强)
 * 数据源: OpenAlex API (https://api.openalex.org/works)
 *         - 完全开放,无需 API key(建议加 mailto 提高 rate limit)
 *         - 覆盖 2.5 亿+ 学术作品
 */

import type { Rule, Hit, RuleContext } from '@seekall/sdk'

interface OpenAlexAuthorship {
  author?: { display_name?: string; id?: string }
}

interface OpenAlexWork {
  id?: string
  title?: string
  display_name?: string
  publication_year?: number
  cited_by_count?: number
  doi?: string
  abstract_inverted_index?: Record<string, number[]>
  authorships?: OpenAlexAuthorship[]
  type?: string
  concepts?: Array<{ display_name?: string; score?: number }>
}

interface OpenAlexResponse {
  results?: OpenAlexWork[]
  meta?: { count?: number }
}

/** 从 inverted index 重建摘要 */
function rebuildAbstract(inverted: Record<string, number[]> | undefined): string | undefined {
  if (!inverted) return undefined
  const positions: Array<{ word: string; pos: number }> = []
  for (const [word, idxs] of Object.entries(inverted)) {
    for (const pos of idxs) {
      positions.push({ word, pos })
    }
  }
  positions.sort((a, b) => a.pos - b.pos)
  return positions.map((p) => p.word).join(' ').slice(0, 280)
}

export const openalexRule: Rule = {
  name: '@seekall/rule-openalex',
  version: '0.5.0',
  riskLevel: 2,
  description: '搜索 OpenAlex 学术图谱(L2 付费独享,2.5 亿+ 作品)',

  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    const mailto = process.env.SEEKALL_MAILTO || 'seekall@example.com'
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=20&mailto=${encodeURIComponent(mailto)}`
    ctx.logger.info(`openalex: fetching works search`)

    const res = await fetch(url, {
      signal: ctx.signal,
      headers: { 'User-Agent': `SeekAll/0.5 (mailto:${mailto})` },
    })
    if (!res.ok) {
      throw new Error(`openalex API ${res.status}`)
    }

    const data = (await res.json()) as OpenAlexResponse
    const works = data.results || []

    return works
      .filter((w) => (w.title || w.display_name) && w.id)
      .map((w) => {
        const authors = (w.authorships || [])
          .map((a) => a.author?.display_name)
          .filter(Boolean)
          .join(', ')
        const concepts = (w.concepts || [])
          .filter((c) => (c.score || 0) > 0.3)
          .map((c) => c.display_name)
          .filter(Boolean)
        return {
          title: w.title || w.display_name || '',
          url: w.doi ? `https://doi.org/${w.doi}` : w.id!,
          snippet: rebuildAbstract(w.abstract_inverted_index),
          source: 'openalex.org',
          meta: {
            publicationYear: w.publication_year,
            citedByCount: w.cited_by_count ?? 0,
            doi: w.doi,
            authors: authors || undefined,
            type: w.type,
            concepts: concepts.length > 0 ? concepts.slice(0, 5) : undefined,
          },
        }
      })
  },
}

export default openalexRule
