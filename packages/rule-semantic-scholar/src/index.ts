/**
 * @seekall/rule-semantic-scholar - Semantic Scholar 论文搜索规则
 *
 * 风险评级: L2 付费独享(学术增强)
 * 数据源: Semantic Scholar API (https://api.semanticscholar.org/graph/v1/paper/search)
 *         - 无需 API key(无 key 100 req/5min,有 key 1 req/s)
 *         - 覆盖 2 亿+ 论文 + AI 增强摘要
 *         - 可选环境变量: S2_API_KEY(https://www.semanticscholar.org/product/api 申请)
 */

import type { Rule, Hit, RuleContext } from '@seekall/sdk'

interface S2Author {
  name?: string
}

interface S2Paper {
  paperId?: string
  title?: string
  abstract?: string
  url?: string
  year?: number
  citationCount?: number
  venue?: string
  authors?: S2Author[]
  tldr?: { text?: string }
  openAccessPdf?: { url?: string }
}

interface S2Response {
  total?: number
  data?: S2Paper[]
}

export const semanticScholarRule: Rule = {
  name: '@seekall/rule-semantic-scholar',
  version: '0.5.0',
  riskLevel: 2,
  description: '搜索 Semantic Scholar 论文(L2 付费独享,2 亿+ 论文 + AI 摘要)',

  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    const apiKey = process.env.S2_API_KEY
    const fields = 'title,abstract,url,year,citationCount,venue,authors,tldr,openAccessPdf'
    const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=20&fields=${fields}`
    ctx.logger.info(`semantic-scholar: fetching paper search`)

    const headers: Record<string, string> = {
      'User-Agent': 'SeekAll/0.5 (+https://github.com/donggua12339/seekall)',
    }
    if (apiKey) {
      headers['x-api-key'] = apiKey
    }

    const res = await fetch(url, { signal: ctx.signal, headers })
    if (!res.ok) {
      throw new Error(`semantic-scholar API ${res.status}`)
    }

    const data = (await res.json()) as S2Response
    const papers = data.data || []

    return papers
      .filter((p) => p.title && (p.url || p.paperId))
      .map((p) => {
        const authors = (p.authors || []).map((a) => a.name).filter(Boolean).join(', ')
        // 优先用 AI 生成的 tldr,其次用 abstract
        const snippet = p.tldr?.text || p.abstract?.slice(0, 280)
        return {
          title: p.title!,
          url: p.url || `https://www.semanticscholar.org/paper/${p.paperId}`,
          snippet,
          source: 'semanticscholar.org',
          meta: {
            paperId: p.paperId,
            year: p.year,
            citationCount: p.citationCount ?? 0,
            venue: p.venue || undefined,
            authors: authors || undefined,
            tldr: p.tldr?.text,
            openAccessPdf: p.openAccessPdf?.url,
          },
        }
      })
  },
}

export default semanticScholarRule
