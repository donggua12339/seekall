/**
 * @seekall/rule-github - GitHub 仓库搜索规则
 *
 * 风险评级：L1 通用开源
 * 数据源：GitHub Search API v2 (https://api.github.com/search/repositories)
 *
 * 示例：
 * ```ts
 * import { createEngine } from '@seekall/sdk'
 * import github from '@seekall/rule-github'
 *
 * const engine = createEngine({ rules: [github] })
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
}

interface GitHubSearchResponse {
  total_count?: number
  items?: GitHubItem[]
}

export const githubRule: Rule = {
  name: '@seekall/rule-github',
  version: '0.5.0',
  riskLevel: 1,
  description: '搜索 GitHub 仓库（L1 通用开源）',

  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=20&sort=stars&order=desc`
    ctx.logger.info(`github: fetching ${url}`)

    const res = await fetch(url, {
      signal: ctx.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'SeekAll/0.5 (+https://github.com/donggua12339/seekall)',
      },
    })
    if (!res.ok) {
      throw new Error(`github API ${res.status}`)
    }

    const data = (await res.json()) as GitHubSearchResponse
    const items = data.items || []

    return items
      .filter((item) => item.full_name && item.html_url)
      .map((item) => ({
        title: item.full_name!,
        url: item.html_url!,
        snippet: item.description?.slice(0, 280) || undefined,
        source: 'github.com',
        meta: {
          stars: item.stargazers_count ?? 0,
          language: item.language || undefined,
          topics: item.topics && item.topics.length > 0 ? item.topics : undefined,
          owner: item.owner?.login,
        },
      }))
  },
}

export default githubRule
