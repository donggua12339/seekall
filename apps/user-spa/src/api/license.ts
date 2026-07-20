import http from './instance'

export interface License {
  id: string
  code: string
  tier: 'trial' | 'monthly' | 'lifetime'
  status: 'unused' | 'used' | 'disabled'
  note?: string | null
  createdAt: string
  usedAt?: string | null
}

export interface InviteTrialCode {
  id: string
  code: string
  tier: 'trial'
  status: 'unused' | 'used' | 'disabled'
  createdAt: string
  usedBy?: { id: string; username: string } | null
}

export interface RedeemRes {
  license: License
  user: { id: string; username: string; isPaid: boolean; tier: string }
}

export const licenseApi = {
  redeem: (code: string) =>
    http.post<unknown, RedeemRes>('/license/redeem', { code }),
  myInviteTrials: () =>
    http.get<unknown, { codes: InviteTrialCode[]; usedThisMonth: number; limit: number }>(
      '/license/invite-trial/my',
    ),
  generateInviteTrial: () =>
    http.post<unknown, InviteTrialCode>('/license/invite-trial'),
}
