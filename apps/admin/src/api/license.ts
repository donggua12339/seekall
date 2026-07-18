import http from './instance'

export interface License {
  id: string
  code: string
  tier: 'trial' | 'monthly' | 'lifetime'
  status: 'unused' | 'used' | 'disabled'
  generatedBy?: string | null
  usedBy?: string | null
  usedAt?: string | null
  note?: string | null
  createdAt: string
  updatedAt: string
}

export interface LicenseListRes {
  list: License[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const licenseApi = {
  list: (params: { page?: number; pageSize?: number; status?: string; tier?: string }) =>
    http.get<unknown, LicenseListRes>('/admin/license', { params }),
  generate: (data: {
    tier: 'trial' | 'monthly' | 'lifetime'
    note?: string
    count?: number
  }) => http.post<unknown, License[]>('/admin/license/generate', data),
  disable: (id: string) => http.post<unknown, License>(`/admin/license/${id}/disable`),
}
