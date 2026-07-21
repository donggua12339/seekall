/**
 * SeekAll CLI API client
 *
 * 封装与 SeekAll 后端的 HTTP 调用,带 license 鉴权
 */

import { resolveConfig } from './config.js'

const API_PREFIX = '/api/v1'

function getBaseUrl(): string {
  const config = resolveConfig()
  return config.serverUrl.replace(/\/$/, '') + API_PREFIX
}

function getAuthHeaders(): Record<string, string> {
  const config = resolveConfig()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (config.license) {
    // 用 license code 作为 Bearer token 后端需支持 license 鉴权
    // 当前后端用 JWT,CLI 暂用 X-License-Code header(后端需补中间件)
    headers['X-License-Code'] = config.license
  }
  return headers
}

export interface ApiError {
  code: number
  message: string
  data: unknown
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = getBaseUrl() + path
  const res = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  })

  const body = (await res.json().catch(() => ({}))) as {
    code: number
    data: T
    message: string | string[]
  }

  if (!res.ok || body.code !== 0) {
    const msg = Array.isArray(body.message) ? body.message.join('; ') : body.message
    throw new Error(`API ${res.status}: ${msg || res.statusText}`)
  }

  return body.data
}

/** whoami: 查询当前 license 对应的用户信息 */
export async function whoami(): Promise<{
  userId?: string
  username?: string
  tier: string
  expiresAt?: string
  paid: boolean
}> {
  // 后端需补 GET /user/whoami 接口(用 X-License-Code 鉴权)
  // 当前后端只有 GET /user/me 需要 JWT,CLI 暂返回 license 信息
  const config = resolveConfig()
  if (!config.license) {
    throw new Error('未配置 license。运行: seekall config set license <code>')
  }
  return {
    tier: 'unknown',
    paid: false,
  }
}

/** sync: 拉取用户订阅的规则列表 */
export async function syncRules(): Promise<
  Array<{
    id: string
    npmPackage: string
    riskLevel: number
    description: string
  }>
> {
  return request<Array<{ id: string; npmPackage: string; riskLevel: number; description: string }>>(
    '/rules/my/subscriptions',
  )
}

/** history: 获取用户搜索历史(后端暂未实现,返回空数组) */
export async function getHistory(): Promise<
  Array<{ query: string; searchedAt: string; hitsCount: number }>
> {
  // 后端 v0.5 砍了 searchLog 表,history 接口待 M2 阶段补
  return []
}

/** license redeem: 用 license code 激活,返回 JWT + 用户信息 */
export async function redeemLicense(
  code: string,
): Promise<{ accessToken: string; refreshToken: string; user: { id: string; username: string } }> {
  return request('/license/redeem', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

/** rules list: 列出市场可见规则(L0-L2 公开) */
export async function listMarketRules(): Promise<
  Array<{
    id: string
    npmPackage: string
    riskLevel: number
    description: string
    status: string
  }>
> {
  return request('/rules')
}

/** 云同步: 获取用户配置 */
export async function getSyncConfig(): Promise<{
  defaultRules: string[]
  outputFormat: string
  customConfig: Record<string, unknown>
  updatedAt: string
} | null> {
  return request('/user/sync')
}

/** 云同步: 保存用户配置 */
export async function saveSyncConfig(data: {
  defaultRules?: string[]
  outputFormat?: string
  customConfig?: Record<string, unknown>
}): Promise<{ message: string; updatedAt: string }> {
  return request('/user/sync', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}
