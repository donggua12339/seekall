/**
 * npm registry API client（直接前端调，无后端依赖）
 *
 * 用于"我的规则"页 + Dashboard 展示规则下载量，激励贡献者持续贡献
 */

const NPM_API = 'https://api.npmjs.org'

interface NpmDownloadPoint {
  downloads: number
  start: string
  end: string
  package: string
}

/** 批量获取多个包的上周下载量（npm API 支持逗号分隔，最多 128 个） */
export async function getBulkWeeklyDownloads(
  packages: string[],
): Promise<Record<string, number>> {
  if (packages.length === 0) return {}
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
