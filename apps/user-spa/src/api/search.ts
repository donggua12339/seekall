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

export interface HotWord {
  word: string
  count: number
}

export const searchApi = {
  search: (q: string, opts?: { pansou?: boolean }) =>
    http.get<unknown, SearchResult>('/search', {
      params: { q, pansou: opts?.pansou ? '1' : '0' },
      // pansou 开启时放宽超时（puppeteer 慢）
      timeout: opts?.pansou ? 35_000 : 25_000,
    }),
  hot: () => http.get<unknown, HotWord[]>('/search/hot', { timeout: 5_000 }),
}
