import http from './instance'

/** Prisma enum 返回字符串 'l0'-'l4'，但部分场景可能返回数字，兼容两种 */
export type RiskLevel = 'l0' | 'l1' | 'l2' | 'l3' | 'l4' | 0 | 1 | 2 | 3 | 4

/** 统一转成数字 0-4 */
export function riskLevelToNum(level: RiskLevel): number {
  if (typeof level === 'number') return level
  return parseInt(String(level).replace('l', ''), 10)
}

export interface Rule {
  id: string
  npmPackage: string
  riskLevel: RiskLevel
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
  mySubmitted: () => http.get<unknown, Rule[]>('/rules/my/submitted'),
  submit: (data: SubmitRuleDto) => http.post<unknown, Rule>('/rules', data),
  subscribe: (id: string) => http.post<unknown, Rule>(`/rules/${id}/subscribe`),
  unsubscribe: (id: string) => http.delete<unknown, Rule>(`/rules/${id}/subscribe`),
}
