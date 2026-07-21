/**
 * @seekall/rule-omdb - OMDB 电影搜索规则
 *
 * 风险评级: L2 付费独享(文娱热点)
 * 数据源: OMDB 官方 API (http://www.omdbapi.com)
 * 需要环境变量: OMDB_API_KEY(https://www.omdbapi.com/apikey.aspx 申请,免费 1000 req/day)
 */

import type { Rule, Hit, RuleContext } from '@seekall/sdk'

interface OMDBResult {
  Title?: string
  Year?: string
  imdbID?: string
  Type?: string
  Poster?: string
  Plot?: string
  imdbRating?: string
  Director?: string
  Genre?: string
}

interface OMDBSearchResponse {
  Response?: string
  Search?: OMDBResult[]
  Error?: string
}

export const omdbRule: Rule = {
  name: '@seekall/rule-omdb',
  version: '0.5.0',
  riskLevel: 2,
  description: '搜索 OMDB 电影/电视(L2 付费独享,文娱热点,需 OMDB_API_KEY)',

  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    const apiKey = process.env.OMDB_API_KEY
    if (!apiKey) {
      ctx.logger.warn('OMDB_API_KEY not set, skipping. Get one at https://www.omdbapi.com/apikey.aspx')
      return []
    }

    const url = `http://www.omdbapi.com/?apikey=${apiKey}&s=${encodeURIComponent(query)}&type=movie&page=1`
    ctx.logger.info(`omdb: fetching search`)

    const res = await fetch(url, {
      signal: ctx.signal,
      headers: { 'User-Agent': 'SeekAll/0.5 (+https://github.com/donggua12339/seekall)' },
    })
    if (!res.ok) {
      throw new Error(`omdb API ${res.status}`)
    }

    const data = (await res.json()) as OMDBSearchResponse
    if (data.Response !== 'True' || !data.Search) {
      return []
    }

    return data.Search.slice(0, 20).map((m) => ({
      title: `${m.Title} (${m.Year})`,
      url: `https://www.imdb.com/title/${m.imdbID}`,
      snippet: `${m.Type} · ${m.Genre || ''} · ${m.Director || ''}`.trim(),
      source: 'omdbapi.com',
      meta: {
        imdbId: m.imdbID,
        year: m.Year,
        type: m.Type,
        poster: m.Poster && m.Poster !== 'N/A' ? m.Poster : undefined,
        imdbRating: m.imdbRating && m.imdbRating !== 'N/A' ? Number(m.imdbRating) : undefined,
      },
    }))
  },
}

export default omdbRule
