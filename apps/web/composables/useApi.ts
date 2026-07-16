/**
 * 觅源 SeekAll - API 调用封装
 */

interface ApiResponse<T = unknown> {
  code: number
  data: T
  message: string
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, unknown>
  headers?: Record<string, string>
}

interface FetchErrorLike {
  statusCode?: number
  status?: number
  data?: { code?: number; message?: string }
  message?: string
}

export function useApi() {
  const config = useRuntimeConfig()
  const authStore = useAuthStore()

  async function request<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, query, headers = {} } = options

    // 鉴权头
    if (authStore.accessToken) {
      headers.Authorization = `Bearer ${authStore.accessToken}`
    }

    const url = `${config.public.apiBase}${path}`

    try {
      const response = await $fetch<ApiResponse<T>>(url, {
        method,
        body: body as never,
        query: query as never,
        headers,
      })

      if (response.code !== 0) {
        throw new Error(response.message)
      }

      return response.data as T
    } catch (err) {
      // Token 过期（HTTP 401 或后端 code=20003）尝试刷新
      const fetchErr = err as FetchErrorLike
      const status = fetchErr.statusCode ?? fetchErr.status ?? 0
      const backendCode = fetchErr.data?.code
      const needRefresh = status === 401 || backendCode === 20003

      // 防止无限重试：只对非 refresh 接口尝试刷新；refresh 自己失败就直接 throw
      const isRefreshCall = path.startsWith('/auth/refresh')

      if (needRefresh && !isRefreshCall && authStore.refreshToken) {
        await authStore.refresh()
        if (authStore.accessToken) {
          headers.Authorization = `Bearer ${authStore.accessToken}`
          const retry = await $fetch<ApiResponse<T>>(url, {
            method,
            body: body as never,
            query: query as never,
            headers,
          })
          if (retry.code !== 0) throw new Error(retry.message)
          return retry.data as T
        }
      }

      // 提取后端错误消息
      const backendMsg = fetchErr.data?.message
      if (backendMsg) throw new Error(backendMsg)
      throw err
    }
  }

  const api = {
    get: <T = unknown>(path: string, query?: Record<string, unknown>) =>
      request<T>(path, { method: 'GET', query }),
    post: <T = unknown>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
    patch: <T = unknown>(path: string, body?: unknown) =>
      request<T>(path, { method: 'PATCH', body }),
    delete: <T = unknown>(path: string) => request<T>(path, { method: 'DELETE' }),
  }

  return { api, request }
}
