/**
 * @seekall/rule-igdb - IGDB 游戏搜索规则
 *
 * 风险评级: L2 付费独享(文娱热点)
 * 数据源: IGDB 官方 API v4 (https://api.igdb.com/v4/games)
 * 需要环境变量:
 *   - IGDB_CLIENT_ID(https://dev.twitch.tv/console/apps 申请)
 *   - IGDB_CLIENT_SECRET(同上)
 *
 * IGDB 用 Twitch OAuth,需先拿 access_token 再调 API。
 */

import type { Rule, Hit, RuleContext } from '@seekall/sdk'

interface IGDBGame {
  id?: number
  name?: string
  summary?: string
  url?: string
  rating?: number
  rating_count?: number
  first_release_date?: number
  genres?: number[]
  platforms?: number[]
}

interface OAuthResponse {
  access_token?: string
  token_type?: string
  expires_in?: number
}

/** 简单 token 缓存(避免每次 search 都拿 token) */
let cachedToken: { token: string; expireAt: number } | null = null

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  if (cachedToken && cachedToken.expireAt > Date.now()) {
    return cachedToken.token
  }
  const url = `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`
  const res = await fetch(url, { method: 'POST' })
  if (!res.ok) {
    throw new Error(`igdb OAuth ${res.status}`)
  }
  const data = (await res.json()) as OAuthResponse
  if (!data.access_token) {
    throw new Error('igdb OAuth: no access_token')
  }
  cachedToken = {
    token: data.access_token,
    expireAt: Date.now() + (data.expires_in || 3600) * 1000 - 60_000, // 提前 1 分钟过期
  }
  return data.access_token
}

export const igdbRule: Rule = {
  name: '@seekall/rule-igdb',
  version: '0.5.0',
  riskLevel: 2,
  description: '搜索 IGDB 游戏(L2 付费独享,文娱热点,需 IGDB_CLIENT_ID + IGDB_CLIENT_SECRET)',

  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    const clientId = process.env.IGDB_CLIENT_ID
    const clientSecret = process.env.IGDB_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      ctx.logger.warn('IGDB_CLIENT_ID or IGDB_CLIENT_SECRET not set, skipping. Get them at https://dev.twitch.tv/console/apps')
      return []
    }

    const token = await getAccessToken(clientId, clientSecret)
    ctx.logger.info(`igdb: fetching games search`)

    // IGDB 用 POST + body 查询
    const res = await fetch('https://api.igdb.com/v4/games', {
      method: 'POST',
      signal: ctx.signal,
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain',
        'User-Agent': 'SeekAll/0.5 (+https://github.com/donggua12339/seekall)',
      },
      body: `search "${query}"; fields name,summary,url,rating,rating_count,first_release_date; limit 20;`,
    })
    if (!res.ok) {
      throw new Error(`igdb API ${res.status}`)
    }

    const games = (await res.json()) as IGDBGame[]

    return games
      .filter((g) => g.name && g.id)
      .map((g) => ({
        title: g.name!,
        url: g.url || `https://www.igdb.com/games/${g.name!.toLowerCase().replace(/\s+/g, '-')}`,
        snippet: g.summary?.slice(0, 280),
        source: 'igdb.com',
        meta: {
          gameId: g.id,
          rating: g.rating ? Math.round(g.rating) / 10 : undefined,
          ratingCount: g.rating_count,
          releaseDate: g.first_release_date
            ? new Date(g.first_release_date * 1000).toISOString()
            : undefined,
        },
      }))
  },
}

export default igdbRule
