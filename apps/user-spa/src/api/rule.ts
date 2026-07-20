import http from './instance'

export interface Rule {
  id: string
  npmPackage: string
  riskLevel: 0 | 1 | 2 | 3 | 4
  description: string
  status: 'pending_review' | 'published' | 'taken_down' | 'banned'
  authorId: string
  author?: { id: string; username: string }
  takedownCount: number
  createdAt: string
  updatedAt: string
}

export interface RuleListRes {
  list: Rule[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface SubmitRuleDto {
  npmPackage: string
  riskLevel: 0 | 1 | 2
  description: string
}

export const ruleApi = {
  list: (params: { page?: number; pageSize?: number; riskLevel?: number }) =>
    http.get<unknown, RuleListRes>('/rules', { params }),
  mySubscriptions: () => http.get<unknown, Rule[]>('/rules/my/subscriptions'),
  submit: (data: SubmitRuleDto) => http.post<unknown, Rule>('/rules', data),
  subscribe: (id: string) => http.post<unknown, Rule>(`/rules/${id}/subscribe`),
  unsubscribe: (id: string) => http.delete<unknown, Rule>(`/rules/${id}/subscribe`),
}
