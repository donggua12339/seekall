import http from './instance'

export interface SearchHit {
  title: string
  url: string
  snippet?: string
  source?: string
  meta?: Record<string, unknown>
}

export interface SourceStat {
  domain: string
  label: string
  category: string
  count: number
}

export interface SearchResult {
  query: string
  total: number
  elapsedMs: number
  sources: SourceStat[]
  results: SearchHit[]
}

export const searchApi = {
  search: (q: string, opts?: { pansou?: boolean }) =>
    http.get<unknown, SearchResult>('/search', {
      params: { q, pansou: opts?.pansou ? '1' : '0' },
      // 网盘搜索走无头浏览器较慢，放宽超时；普通搜索保持快速失败
      timeout: opts?.pansou ? 40_000 : 20_000,
    }),
}
