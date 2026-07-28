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
  badge?: 'contributor' | 'reviewer' | 'early_adopter' | null
  createdAt: string
}

export interface LoginRes {
  accessToken: string
  refreshToken: string
  user: UserInfo
}

export interface RegisterRes {
  message: string
}

export const authApi = {
  login: (data: { username: string; password: string }) =>
    http.post<unknown, LoginRes>('/auth/login', data),
  register: (data: { username: string; email: string; password: string; agreementVersion: string }) =>
    http.post<unknown, RegisterRes>('/auth/register', data),
  me: () => http.get<unknown, UserInfo>('/user/me'),
  logout: () => http.post('/auth/logout'),
  requestPasswordReset: (email: string) =>
    http.post('/auth/password-reset/request', { email }),
  resetPassword: (token: string, newPassword: string) =>
    http.post('/auth/password-reset/confirm', { token, newPassword }),
}
