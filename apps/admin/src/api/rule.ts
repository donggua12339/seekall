import http from './instance'

export interface Rule {
  id: string
  npmPackage: string
  riskLevel: 'l0' | 'l1' | 'l2' | 'l3' | 'l4'
  description: string
  authorId: string
  author?: { id: string; username: string }
  status: 'pending_review' | 'published' | 'taken_down' | 'banned'
  version: string
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

export interface RuleReview {
  id: string
  reviewerId: string
  reviewerUsername: string
  approve: boolean
  comment: string | null
  createdAt: string
}

export interface RuleReviewSummary {
  ruleId: string
  npmPackage: string
  riskLevel: string
  status: string
  summary: {
    total: number
    approvals: number
    rejections: number
    threshold: number
    readyForFinalReview: boolean
  }
  reviews: RuleReview[]
}

export const ruleApi = {
  list: (params: { page?: number; pageSize?: number; riskLevel?: number }) =>
    http.get<unknown, RuleListRes>('/rules', { params }),
  get: (id: string) => http.get<unknown, Rule>(`/rules/${id}`),
  finalReview: (id: string, data: { approve: boolean; note?: string }) =>
    http.post<unknown, Rule>(`/admin/rules/${id}/final-review`, data),
  takedown: (id: string, data: { reason: string }) =>
    http.post<unknown, Rule>(`/admin/rules/${id}/takedown`, data),
  create: (data: { npmPackage: string; riskLevel: number; description: string }) =>
    http.post<unknown, Rule>('/admin/rules', data),
  listReviews: (id: string) =>
    http.get<unknown, RuleReviewSummary>(`/admin/rules/${id}/reviews`),
}
