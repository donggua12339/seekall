import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/stores/auth'

const baseURL = import.meta.env.VITE_API_BASE_URL || ''
const apiBase = baseURL ? `${baseURL}/api/v1` : '/api/v1'

const instance: AxiosInstance = axios.create({
  baseURL: apiBase,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
})

// 请求拦截器：自动加 Authorization
instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const auth = useAuthStore()
    if (auth.accessToken) {
      config.headers.Authorization = `Bearer ${auth.accessToken}`
    }
    return config
  },
  (err) => Promise.reject(err),
)

// 响应拦截器：统一处理 code + 401 自动刷新
let refreshing = false
let pendingQueue: Array<(token: string) => void> = []

instance.interceptors.response.use(
  (res) => {
    // 后端统一响应格式：{ code, data, message }
    const body = res.data
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 0) {
        return body.data
      }
      // 业务错误
      const err = new Error(body.message || '请求失败') as Error & { code?: number }
      err.code = body.code
      return Promise.reject(err)
    }
    return body
  },
  async (err) => {
    const auth = useAuthStore()
    const originalRequest = err.config
    if (err.response?.status === 401 && !originalRequest._retry) {
      if (refreshing) {
        // 排队等刷新
        return new Promise((resolve) => {
          pendingQueue.push((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(instance(originalRequest))
          })
        })
      }
      originalRequest._retry = true
      refreshing = true
      try {
        const res = await axios.post(`${apiBase}/auth/refresh`, {
          refreshToken: auth.refreshToken,
        })
        const { accessToken, refreshToken } = res.data.data
        auth.setTokens(accessToken, refreshToken)
        pendingQueue.forEach((cb) => cb(accessToken))
        pendingQueue = []
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return instance(originalRequest)
      } catch (refreshErr) {
        pendingQueue = []
        auth.logout()
        window.location.href = '/login'
        return Promise.reject(refreshErr)
      } finally {
        refreshing = false
      }
    }
    // 其他错误
    const msg = err.response?.data?.message || err.message || '网络错误'
    return Promise.reject(new Error(msg))
  },
)

export default instance
