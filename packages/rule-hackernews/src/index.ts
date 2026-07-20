/**
 * @seekall/rule-hackernews - Hacker News 故事搜索规则
 *
 * 风险评级：L1 通用开源
 * 数据源：HN Algolia Search API (https://hn.algolia.com/api/v1/search)
 *
 * 示例：
 * ```ts
 * import { createEngine } from '@seekall/sdk'
 * import hackernews from '@seekall/rule-hackernews'
 *
 * const engine = createEngine({ rules: [hackernews] })
 * const hits = await engine.search('rust async runtime')
 * ```
 */

import type { Rule, Hit, RuleContext } from '@seekall/sdk'

interface HNHit {
  objectID?: string
  title?: string | null
  url?: string | null
  story_text?: string | null
  points?: number | null
  author?: string | null
  num_comments?: number | null
  created_at?: string
}

interface HNSearchResponse {
  hits?: HNHit[]
  nbHits?: number
}

export const hackernewsRule: Rule = {
  name: '@seekall/rule-hackernews',
  version: '0.5.0',
  riskLevel: 1,
  description: '搜索 Hacker News 故事（L1 通用开源）',

  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=20`
    ctx.logger.info(`hackernews: fetching ${url}`)

    const res = await fetch(url, {
      signal: ctx.signal,
      headers: {
        'User-Agent': 'SeekAll/0.5 (+https://github.com/donggua12339/seekall)',
      },
    })
    if (!res.ok) {
      throw new Error(`hackernews API ${res.status}`)
    }

    const data = (await res.json()) as HNSearchResponse
    const hits = data.hits || []

    return hits
      .filter((h) => h.title && h.objectID)
      .map((h) => {
        // HN 故事可能没有外部 url（如 Ask HN），用 HN 讨论页作为 url
        const storyUrl = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`
        // story_text 是 HTML，简单去标签
        const snippet = h.story_text
          ? h.story_text.replace(/<[^>]+>/g, '').slice(0, 280)
          : undefined

        return {
          title: h.title!,
          url: storyUrl,
          snippet,
          source: 'news.ycombinator.com',
          meta: {
            points: h.points ?? 0,
            author: h.author || undefined,
            comments: h.num_comments ?? 0,
            createdAt: h.created_at,
            objectId: h.objectID,
          },
        }
      })
  },
}

export default hackernewsRule
