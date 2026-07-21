/**
 * @seekall/rule-tmdb - TMDB 电影/电视搜索规则
 *
 * 风险评级: L2 付费独享(文娱热点)
 * 数据源: TMDB 官方 API (https://api.themoviedb.org/3/search/multi)
 * 需要环境变量: TMDB_API_KEY(https://www.themoviedb.org/settings/api 申请)
 *
 * 示例:
 * ```ts
 * import { createEngine } from '@seekall/sdk'
 * import tmdb from '@seekall/rule-tmdb'
 *
 * // 先 export TMDB_API_KEY=your_key
 * const engine = createEngine({ rules: [tmdb] })
 * const hits = await engine.search('inception')
 * ```
 */

import type { Rule, Hit, RuleContext } from '@seekall/sdk'

interface TMDBResult {
  id?: number
  title?: string
  name?: string
  overview?: string
  media_type?: string
  poster_path?: string | null
  release_date?: string
  first_air_date?: string
  vote_average?: number
  vote_count?: number
}

interface TMDBResponse {
  results?: TMDBResult[]
}

const POSTER_BASE = 'https://image.tmdb.org/t/p/w200'

export const tmdbRule: Rule = {
  name: '@seekall/rule-tmdb',
  version: '0.5.0',
  riskLevel: 2,
  description: '搜索 TMDB 电影/电视(L2 付费独享,文娱热点,需 TMDB_API_KEY)',

  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    const apiKey = process.env.TMDB_API_KEY
    if (!apiKey) {
      ctx.logger.warn('TMDB_API_KEY not set, skipping. Get one at https://www.themoviedb.org/settings/api')
      return []
    }

    const url = `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&page=1&language=zh-CN`
    ctx.logger.info(`tmdb: fetching search/multi`)

    const res = await fetch(url, {
      signal: ctx.signal,
      headers: { 'User-Agent': 'SeekAll/0.5 (+https://github.com/donggua12339/seekall)' },
    })
    if (!res.ok) {
      throw new Error(`tmdb API ${res.status}`)
    }

    const data = (await res.json()) as TMDBResponse
    const results = data.results || []

    return results
      .filter((r) => (r.title || r.name) && r.id)
      .filter((r) => r.media_type !== 'person')
      .slice(0, 20)
      .map((r) => ({
        title: r.title || r.name || '',
        url: `https://www.themoviedb.org/${r.media_type}/${r.id}`,
        snippet: r.overview?.slice(0, 280),
        source: 'themoviedb.org',
        meta: {
          mediaType: r.media_type,
          poster: r.poster_path ? `${POSTER_BASE}${r.poster_path}` : undefined,
          releaseDate: r.release_date || r.first_air_date,
          voteAverage: r.vote_average,
          voteCount: r.vote_count,
        },
      }))
  },
}

export default tmdbRule
