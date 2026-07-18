import http from './instance'

export interface DmcaNotice {
  id: string
  infringingUrl: string
  ruleId: string | null
  rule?: { id: string; npmPackage: string; description: string } | null
  originalTitle: string
  copyrightOwner: string
  reporterEmail: string
  reporterRole: 'owner' | 'agent'
  goodFaithStatement: boolean
  accuracyStatement: boolean
  electronicSignature: string
  notes?: string | null
  status: 'pending' | 'verified' | 'actioned' | 'rejected'
  handlerAdmin?: { id: string; username: string } | null
  handlerNote?: string | null
  handledAt?: string | null
  createdAt: string
}

export interface DmcaListRes {
  list: DmcaNotice[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface TransparencyReport {
  month: string
  totalNotices: number
  actioned: number
  rejected: number
  pending: number
  avgResponseHours: number
}

export const dmcaApi = {
  list: (params: { page?: number; pageSize?: number; status?: string }) =>
    http.get<unknown, DmcaListRes>('/admin/dmca', { params }),
  get: (id: string) => http.get<unknown, DmcaNotice>(`/admin/dmca/${id}`),
  handle: (id: string, data: { action: 'verify' | 'action' | 'reject'; note: string }) =>
    http.post<unknown, DmcaNotice>(`/admin/dmca/${id}/handle`, data),
  transparency: () => http.get<unknown, TransparencyReport>('/dmca/transparency'),
}
