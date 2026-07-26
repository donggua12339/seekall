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
  search: (q: string) => http.get<unknown, SearchResult>('/search', { params: { q } }),
}
