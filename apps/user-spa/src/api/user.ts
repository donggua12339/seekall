import http from './instance'

export interface UserProfile {
  id: string
  username: string
  email: string
  isPaid: boolean
  paidUntil?: string | null
  tier?: 'trial' | 'monthly' | 'lifetime' | null
  status: 'pending_verification' | 'active' | 'banned' | 'deleted'
  avatarUrl?: string | null
  bio?: string | null
  createdAt: string
}

export interface Session {
  id: string
  userAgent?: string
  ip?: string
  createdAt: string
  lastUsedAt: string
}

export const userApi = {
  profile: () => http.get<unknown, UserProfile>('/user/profile'),
  updateProfile: (data: { avatarUrl?: string; bio?: string }) =>
    http.patch<unknown, UserProfile>('/user/profile', data),
  deleteAccount: () => http.delete('/user/account'),
  sessions: () => http.get<unknown, Session[]>('/user/sessions'),
  deleteSession: (id: string) => http.delete(`/user/sessions/${id}`),
}
