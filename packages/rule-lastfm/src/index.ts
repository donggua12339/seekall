/**
 * @seekall/rule-lastfm - Last.fm 音乐搜索规则
 *
 * 风险评级: L2 付费独享(文娱热点)
 * 数据源: Last.fm 官方 API (https://ws.audioscrobbler.com/2.0)
 * 需要环境变量: LASTFM_API_KEY(https://www.last.fm/api/account/create 申请)
 */

import type { Rule, Hit, RuleContext } from '@seekall/sdk'

interface LastfmTrack {
  name?: string
  url?: string
  artist?: string
  listeners?: string
  image?: Array<{ '#text'?: string; size?: string }>
}

interface LastfmResponse {
  results?: {
    trackmatches?: { track?: LastfmTrack | LastfmTrack[] }
  }
  error?: number
  message?: string
}

export const lastfmRule: Rule = {
  name: '@seekall/rule-lastfm',
  version: '0.5.0',
  riskLevel: 2,
  description: '搜索 Last.fm 音乐曲目(L2 付费独享,文娱热点,需 LASTFM_API_KEY)',

  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    const apiKey = process.env.LASTFM_API_KEY
    if (!apiKey) {
      ctx.logger.warn('LASTFM_API_KEY not set, skipping. Get one at https://www.last.fm/api/account/create')
      return []
    }

    const url = `https://ws.audioscrobbler.com/2.0/?method=track.search&track=${encodeURIComponent(query)}&api_key=${apiKey}&format=json&limit=20`
    ctx.logger.info(`lastfm: fetching track.search`)

    const res = await fetch(url, {
      signal: ctx.signal,
      headers: { 'User-Agent': 'SeekAll/0.5 (+https://github.com/donggua12339/seekall)' },
    })
    if (!res.ok) {
      throw new Error(`lastfm API ${res.status}`)
    }

    const data = (await res.json()) as LastfmResponse
    if (data.error) {
      throw new Error(`lastfm error ${data.error}: ${data.message}`)
    }

    const tracks = data.results?.trackmatches?.track
    const trackList = Array.isArray(tracks) ? tracks : tracks ? [tracks] : []

    return trackList
      .filter((t) => t.name && t.url)
      .map((t) => {
        const largeImg = t.image?.find((i) => i.size === 'large')?.['#text']
        return {
          title: `${t.name} - ${t.artist || 'Unknown'}`,
          url: t.url!,
          snippet: `${Number(t.listeners || 0).toLocaleString()} listeners`,
          source: 'last.fm',
          meta: {
            trackName: t.name,
            artist: t.artist,
            listeners: t.listeners ? Number(t.listeners) : 0,
            cover: largeImg || undefined,
          },
        }
      })
  },
}

export default lastfmRule
