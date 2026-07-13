// 觅源 SeekAll - Provider 接口定义
// 所有数据源 Provider 必须实现此接口

export type ProviderCategory = 'netdisk' | 'magnet' | 'tg' | 'forum'

export interface SearchQuery {
  keyword: string
  page: number
  pageSize: number
  category?: string
  filters?: Record<string, unknown>
}

export interface SearchResult {
  title: string
  url: string
  source: string // provider name
  sourceDisplayName: string
  category: ProviderCategory
  fileSize?: number
  fileType?: string
  resourceMeta?: Record<string, unknown>
}

export interface Provider {
  readonly name: string
  readonly displayName: string
  readonly category: ProviderCategory
  readonly enabled: boolean

  search(query: SearchQuery): Promise<SearchResult[]>
  healthCheck(): Promise<boolean>
}

export const PROVIDER_TOKEN = Symbol('PROVIDER')
