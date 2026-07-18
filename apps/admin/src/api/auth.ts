import http from './instance'

export interface UserInfo {
  id: string
  username: string
  email: string
  role: 'super_admin' | 'user'
  isPaid: boolean
  paidUntil?: string | null
  tier?: 'trial' | 'monthly' | 'lifetime' | null
  status: 'pending_verification' | 'active' | 'banned' | 'deleted'
}

export interface LoginRes {
  accessToken: string
  refreshToken: string
  user: UserInfo
}

export const authApi = {
  login: (data: { username: string; password: string }) =>
    http.post<unknown, LoginRes>('/auth/login', data),
  me: () => http.post<unknown, UserInfo>('/auth/me'),
  logout: () => http.post('/auth/logout'),
}
