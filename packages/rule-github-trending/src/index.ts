/**
 * @seekall/rule-github-trending - GitHub Trending 仓库搜索规则
 *
 * 风险评级: L2 付费独享(开发者热点)
 * 数据源: GitHub Search API v2 (https://api.github.com/search/repositories)
 *         - 按 stars 排序,过滤最近 7 天创建/更新
 *         - 官方 API,遵守 rate limit
 *
 * 与 @seekall/rule-github 的区别:
 *   - rule-github: 全量搜索,按 stars 排序(L1 免费)
 *   - rule-github-trending: 只返回最近 7 天热门(L2 付费,趋势发现)
 *
 * 示例:
 * ```ts
 * import { createEngine } from '@seekall/sdk'
 * import githubTrending from '@seekall/rule-github-trending'
 *
 * const engine = createEngine({ rules: [githubTrending] })
 * const hits = await engine.search('react state machine')
 * ```
 */

import type { Rule, Hit, RuleContext } from '@seekall/sdk'

interface GitHubOwner {
  login?: string
}

interface GitHubItem {
  id?: number
  name?: string
  full_name?: string
  html_url?: string
  description?: string | null
  stargazers_count?: number
  language?: string | null
  topics?: string[]
  owner?: GitHubOwner
  pushed_at?: string
  created_at?: string
}

interface GitHubSearchResponse {
  total_count?: number
  items?: GitHubItem[]
}

export const githubTrendingRule: Rule = {
  name: '@seekall/rule-github-trending',
  version: '0.5.0',
  riskLevel: 2,
  description: '搜索 GitHub 最近 7 天热门仓库(L2 付费独享,趋势发现)',

  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    // 过去 7 天有 push 的仓库,按 stars 排序
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}+pushed:>${since}&per_page=20&sort=stars&order=desc`
    ctx.logger.info(`github-trending: fetching ${url}`)

    const res = await fetch(url, {
      signal: ctx.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'SeekAll/0.5 (+https://github.com/donggua12339/seekall)',
      },
    })
    if (!res.ok) {
      throw new Error(`github-trending API ${res.status}`)
    }

    const data = (await res.json()) as GitHubSearchResponse
    const items = data.items || []

    return items
      .filter((item) => item.full_name && item.html_url)
      .map((item) => ({
        title: item.full_name!,
        url: item.html_url!,
        snippet: item.description?.slice(0, 280) || undefined,
        source: 'github.com/trending',
        meta: {
          stars: item.stargazers_count ?? 0,
          language: item.language || undefined,
          topics: item.topics && item.topics.length > 0 ? item.topics : undefined,
          owner: item.owner?.login,
          pushedAt: item.pushed_at,
          createdAt: item.created_at,
        },
      }))
  },
}

export default githubTrendingRule
