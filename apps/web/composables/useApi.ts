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

export function useApi() {
  const config = useRuntimeConfig()
  const authStore = useAuthStore()

  async function request<T = unknown>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
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
      // Token 过期尝试刷新
      if (err instanceof Error && err.message.includes('Token')) {
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
      throw err
    }
  }

  const api = {
    get: <T = unknown>(path: string, query?: Record<string, unknown>) =>
      request<T>(path, { method: 'GET', query }),
    post: <T = unknown>(path: string, body?: unknown) =>
      request<T>(path, { method: 'POST', body }),
    patch: <T = unknown>(path: string, body?: unknown) =>
      request<T>(path, { method: 'PATCH', body }),
    delete: <T = unknown>(path: string) =>
      request<T>(path, { method: 'DELETE' }),
  }

  return { api, request }
}
