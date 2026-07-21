/**
 * @seekall/rule-reddit - Reddit 热门帖子搜索规则
 *
 * 风险评级: L2 付费独享(开发者热点)
 * 数据源: Reddit 官方 JSON API (https://www.reddit.com/search.json)
 *
 * 示例:
 * ```ts
 * import { createEngine } from '@seekall/sdk'
 * import reddit from '@seekall/rule-reddit'
 *
 * const engine = createEngine({ rules: [reddit] })
 * const hits = await engine.search('rust async')
 * ```
 */

import type { Rule, Hit, RuleContext } from '@seekall/sdk'

interface RedditPost {
  id?: string
  title?: string
  url?: string
  permalink?: string
  selftext?: string
  score?: number
  num_comments?: number
  author?: string
  subreddit?: string
  created_utc?: number
  over_18?: boolean
}

interface RedditSearchResponse {
  data?: {
    children?: Array<{ data: RedditPost }>
  }
}

export const redditRule: Rule = {
  name: '@seekall/rule-reddit',
  version: '0.5.0',
  riskLevel: 2,
  description: '搜索 Reddit 热门帖子(L2 付费独享,开发者热点)',

  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    const url = `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&sort=relevance&limit=20&t=week`
    ctx.logger.info(`reddit: fetching ${url}`)

    const res = await fetch(url, {
      signal: ctx.signal,
      headers: {
        'User-Agent': 'SeekAll/0.5 (+https://github.com/donggua12339/seekall)',
        Accept: 'application/json',
      },
    })
    if (!res.ok) {
      throw new Error(`reddit API ${res.status}`)
    }

    const data = (await res.json()) as RedditSearchResponse
    const posts = (data.data?.children || []).map((c) => c.data)

    return posts
      .filter((p) => p.title && (p.url || p.permalink))
      .filter((p) => !p.over_18) // 过滤 NSFW
      .map((p) => {
        // 自帖(selftext)用 permalink,外链用 url
        const postUrl = p.permalink
          ? `https://www.reddit.com${p.permalink}`
          : p.url || ''
        const snippet = p.selftext ? p.selftext.replace(/\s+/g, ' ').slice(0, 280) : undefined

        return {
          title: p.title!,
          url: postUrl,
          snippet,
          source: 'reddit.com',
          meta: {
            score: p.score ?? 0,
            comments: p.num_comments ?? 0,
            author: p.author || undefined,
            subreddit: p.subreddit ? `r/${p.subreddit}` : undefined,
            createdAt: p.created_utc
              ? new Date(p.created_utc * 1000).toISOString()
              : undefined,
          },
        }
      })
  },
}

export default redditRule
