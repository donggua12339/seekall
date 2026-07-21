/**
 * npm registry API client(直接前端调,无后端依赖)
 *
 * 用于 admin Dashboard + docs-site 规则市场展示下载量
 */

const NPM_API = 'https://api.npmjs.org'

export interface NpmDownloadPoint {
  downloads: number
  start: string
  end: string
  package: string
}

export interface NpmPackageMeta {
  name: string
  'dist-tags': { latest: string }
  license: string
  description: string
  versions: Record<string, unknown>
  time: { created: string; modified: string; [version: string]: string }
}

/** 获取单个包上周下载量 */
export async function getWeeklyDownloads(pkg: string): Promise<NpmDownloadPoint> {
  const res = await fetch(`${NPM_API}/downloads/point/last-week/${encodeURIComponent(pkg)}`)
  if (!res.ok) throw new Error(`npm API ${res.status}`)
  return res.json()
}

/** 批量获取多个包的上周下载量(npm API 支持逗号分隔) */
export async function getBulkWeeklyDownloads(
  packages: string[],
): Promise<Record<string, number>> {
  if (packages.length === 0) return {}
  // npm bulk API 最多 128 个包
  const batch = packages.slice(0, 128)
  const url = `${NPM_API}/downloads/point/last-week/${batch
    .map(encodeURIComponent)
    .join(',')}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`npm bulk API ${res.status}`)
  const data = (await res.json()) as Record<string, NpmDownloadPoint>
  const result: Record<string, number> = {}
  for (const [pkg, info] of Object.entries(data)) {
    result[pkg] = info.downloads
  }
  return result
}

/** 获取包元数据(版本 / license / 描述) */
export async function getPackageMeta(pkg: string): Promise<NpmPackageMeta | null> {
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkg)}`)
  if (!res.ok) return null
  return res.json()
}

/** SeekAll 官方包列表 */
export const SEEKALL_PACKAGES = [
  '@seekall/sdk',
  '@seekall/rule-arxiv',
  '@seekall/rule-crossref',
  '@seekall/rule-pubmed',
  '@seekall/rule-github',
  '@seekall/rule-hackernews',
  '@seekall/rule-reddit',
  '@seekall/rule-producthunt',
  '@seekall/rule-github-trending',
  '@seekall/rule-hackernews-trending',
  '@seekall/rule-tmdb',
  '@seekall/rule-omdb',
  '@seekall/rule-lastfm',
  '@seekall/rule-igdb',
  '@seekall/rule-arxiv-trending',
  '@seekall/rule-openalex',
  '@seekall/rule-semantic-scholar',
]
