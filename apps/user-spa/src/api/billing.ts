import http from './instance'

export interface Transaction {
  id: string
  licenseCode: string
  tier: 'trial' | 'monthly' | 'lifetime'
  tierLabel: string
  amount: number
  wmOrderId: string | null
  status: 'unused' | 'used' | 'disabled'
  paidAt: string
  createdAt: string
}

export interface Receipt {
  receiptId: string
  licenseCode: string
  tier: string
  tierLabel: string
  amount: number
  title: string
  email: string
  issuedAt: string
  paidAt: string
  disclaimer: string
}

export interface Refund {
  id: string
  licenseCode: string
  tier: string
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
}

export const billingApi = {
  transactions: () => http.get<unknown, Transaction[]>('/user/transactions'),
  requestReceipt: (data: { licenseCode: string; title: string; email: string }) =>
    http.post<unknown, Receipt>('/user/receipts', data),
  requestRefund: (data: { licenseCode: string; reason: string }) =>
    http.post<unknown, { message: string; licenseCode: string; tier: string; reason: string }>(
      '/user/refunds',
      data,
    ),
  myRefunds: () => http.get<unknown, Refund[]>('/user/refunds'),
}
