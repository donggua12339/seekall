import http from './instance'

export interface DmcaNotice {
  id: string
  infringingUrl: string
  ruleId: string | null
  originalTitle: string
  copyrightOwner: string
  reporterEmail: string
  reporterRole: 'owner' | 'agent'
  status: 'pending' | 'verified' | 'actioned' | 'rejected'
  handlerAdmin?: { id: string; username: string } | null
  handlerNote?: string | null
  handledAt?: string | null
  createdAt: string
}

export interface SubmitDmcaDto {
  infringingUrl: string
  ruleId?: number
  originalTitle: string
  copyrightOwner: string
  reporterEmail: string
  reporterRole: 'owner' | 'agent'
  goodFaithStatement: boolean
  accuracyStatement: boolean
  electronicSignature: string
  notes?: string
}

export const dmcaApi = {
  submit: (data: SubmitDmcaDto) =>
    http.post<unknown, DmcaNotice>('/dmca/notice', data),
  transparency: () =>
    http.get<unknown, {
      month: string
      totalNotices: number
      actioned: number
      rejected: number
      pending: number
      avgResponseHours: number
    }>('/dmca/transparency'),
}
