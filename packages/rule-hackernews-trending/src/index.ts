/**
 * @seekall/rule-hackernews-trending - Hacker News 热门故事规则
 *
 * 风险评级: L2 付费独享(开发者热点)
 * 数据源: HN Algolia Search API (https://hn.algolia.com/api/v1/search)
 *         - 按 popularity 排序(默认按时间)
 *         - 只返回 points >= 50 的热门故事
 *         - 过去 7 天
 *
 * 与 @seekall/rule-hackernews 的区别:
 *   - rule-hackernews: 关键词搜索,按相关度(L1 免费)
 *   - rule-hackernews-trending: 按 popularity + 高票过滤(L2 付费,趋势发现)
 *
 * 示例:
 * ```ts
 * import { createEngine } from '@seekall/sdk'
 * import hnTrending from '@seekall/rule-hackernews-trending'
 *
 * const engine = createEngine({ rules: [hnTrending] })
 * const hits = await engine.search('rust')
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

/** 高票阈值:只返回 points >= 50 的故事 */
const MIN_POINTS = 50

export const hackernewsTrendingRule: Rule = {
  name: '@seekall/rule-hackernews-trending',
  version: '0.5.0',
  riskLevel: 2,
  description: '搜索 Hacker News 热门故事(L2 付费独享,points>=50)',

  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    // 按 popularity 排序,过去 7 天
    const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=50&numericFilters=points>=${MIN_POINTS},created_at_i>=${Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60}`
    ctx.logger.info(`hackernews-trending: fetching ${url}`)

    const res = await fetch(url, {
      signal: ctx.signal,
      headers: {
        'User-Agent': 'SeekAll/0.5 (+https://github.com/donggua12339/seekall)',
      },
    })
    if (!res.ok) {
      throw new Error(`hackernews-trending API ${res.status}`)
    }

    const data = (await res.json()) as HNSearchResponse
    const hits = data.hits || []

    return hits
      .filter((h) => h.title && h.objectID)
      .map((h) => {
        const storyUrl = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`
        const snippet = h.story_text
          ? h.story_text.replace(/<[^>]+>/g, '').slice(0, 280)
          : undefined

        return {
          title: h.title!,
          url: storyUrl,
          snippet,
          source: 'news.ycombinator.com/trending',
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

export default hackernewsTrendingRule
