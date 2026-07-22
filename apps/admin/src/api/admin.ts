import http from './instance'

export interface AdminUser {
  id: string
  username: string
  email: string
  role: 'super_admin' | 'user'
  isPaid: boolean
  paidUntil?: string | null
  tier?: 'trial' | 'monthly' | 'lifetime' | null
  status: 'pending_verification' | 'active' | 'banned' | 'deleted'
  bannedReason?: string | null
  badge?: 'contributor' | 'reviewer' | 'early_adopter' | null
  createdAt: string
}

export interface UserListRes {
  list: AdminUser[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface Dashboard {
  userCount: number
  paidUserCount: number
  licenseCount: number
}

export interface AuditLog {
  id: string
  adminId: string
  admin?: { id: string; username: string }
  action: string
  targetType: string
  targetId?: string | null
  detail?: unknown
  createdAt: string
}

export interface Analytics {
  days: number
  since: string
  metrics: {
    newUsers: number
    newLicenses: number
    newRules: number
    reviews: number
    takedowns: number
  }
}

export interface RefundRequest {
  id: string
  adminId: string
  admin?: { id: string; username: string }
  action: string
  targetType: string
  targetId?: string | null
  detail: {
    licenseCode?: string
    tier?: string
    reason?: string
    userId?: string
    status?: 'pending' | 'approved' | 'rejected'
    reviewedBy?: string
    reviewedAt?: string
    adminNote?: string | null
  }
  createdAt: string
}

export interface RefundListRes {
  list: RefundRequest[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const adminApi = {
  dashboard: () => http.get<unknown, Dashboard>('/admin/dashboard'),
  analytics: (days: number = 7) =>
    http.get<unknown, Analytics>('/admin/analytics', { params: { days } }),
  listUsers: (params: { page?: number; pageSize?: number; search?: string }) =>
    http.get<unknown, UserListRes>('/admin/users', { params }),
  banUser: (id: string, reason: string) =>
    http.patch<unknown, AdminUser>(`/admin/users/${id}/ban`, { reason }),
  unbanUser: (id: string) => http.patch<unknown, AdminUser>(`/admin/users/${id}/unban`),
  setUserBadge: (id: string, badge: string) =>
    http.patch<unknown, AdminUser>(`/admin/users/${id}/badge`, { badge }),
  auditLogs: (params: { page?: number; pageSize?: number }) =>
    http.get<unknown, { list: AuditLog[]; total: number; page: number; pageSize: number }>(
      '/admin/audit-logs',
      { params },
    ),
  listRefunds: (params: { page?: number; pageSize?: number; status?: string }) =>
    http.get<unknown, RefundListRes>('/admin/refunds', { params }),
  approveRefund: (id: string, note?: string) =>
    http.post<unknown, RefundRequest>(`/admin/refunds/${id}/approve`, { note }),
  rejectRefund: (id: string, note?: string) =>
    http.post<unknown, RefundRequest>(`/admin/refunds/${id}/reject`, { note }),
}
