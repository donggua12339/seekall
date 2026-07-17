/**
 * @seekall/rule-pubmed - pubmed 生物医学文献搜索规则
 *
 * 风险评级：L0 学术纯净
 * 数据源：NCBI E-utilities API（eutils.ncbi.nlm.nih.gov）
 *
 * 流程：esearch (拿 PMID 列表) -> esummary (拿标题/作者/摘要)
 */

import type { Rule, Hit, RuleContext } from '@seekall/sdk'

interface ESearchResult {
  esearchresult?: {
    idlist?: string[]
    count?: string
  }
}

interface ESummaryDoc {
  uid?: string
  title?: string
  authors?: Array<{ name?: string; authtype?: string }>
  source?: string
  pubdate?: string
  abstract?: string
}

interface ESummaryResult {
  result?: {
    uids?: string[]
    [k: string]: ESummaryDoc | string[] | undefined
  }
}

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

export const pubmedRule: Rule = {
  name: '@seekall/rule-pubmed',
  version: '0.5.0',
  riskLevel: 0,
  description: '搜索 pubmed 生物医学文献（L0 学术纯净）',

  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    // Step 1: esearch 拿 PMID 列表
    const esearchUrl = `${EUTILS}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmode=json&retmax=20`
    ctx.logger.info(`pubmed esearch: ${esearchUrl}`)

    const esRes = await fetch(esearchUrl, {
      signal: ctx.signal,
      headers: { 'User-Agent': 'SeekAll/0.5 (+https://github.com/donggua12339/seekall)' },
    })
    if (!esRes.ok) throw new Error(`pubmed esearch ${esRes.status}`)
    const esData = (await esRes.json()) as ESearchResult
    const idList = esData.esearchresult?.idlist ?? []

    if (idList.length === 0) return []

    // Step 2: esummary 拿元数据
    const esummaryUrl = `${EUTILS}/esummary.fcgi?db=pubmed&id=${idList.join(',')}&retmode=json`
    ctx.logger.info(`pubmed esummary: ${esummaryUrl}`)

    const suRes = await fetch(esummaryUrl, {
      signal: ctx.signal,
      headers: { 'User-Agent': 'SeekAll/0.5 (+https://github.com/donggua12339/seekall)' },
    })
    if (!suRes.ok) throw new Error(`pubmed esummary ${suRes.status}`)
    const suData = (await suRes.json()) as ESummaryResult
    const result = suData.result
    if (!result?.uids) return []

    const hits: Hit[] = []
    for (const uid of result.uids) {
      const doc = result[uid] as ESummaryDoc | undefined
      if (!doc?.title) continue
      const pmid = doc.uid || uid
      const authors = (doc.authors ?? [])
        .filter((a) => a.authtype === 'Author')
        .map((a) => a.name)
        .filter(Boolean)

      hits.push({
        title: doc.title,
        url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
        snippet: doc.abstract?.slice(0, 280),
        source: 'pubmed.ncbi.nlm.nih.gov',
        meta: {
          pmid,
          authors: authors.length ? authors.join(', ') : undefined,
          journal: doc.source || undefined,
          published: doc.pubdate || undefined,
        },
      })
    }
    return hits
  },
}

export default pubmedRule
