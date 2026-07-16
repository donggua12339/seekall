import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface User {
  id: string
  username: string
  email: string
  role: string
  isPaid: boolean
  paidUntil: string | null
  status: string
  badge: string | null
  avatarUrl: string | null
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)

  const isLoggedIn = computed(() => !!user.value && !!accessToken.value)
  const isAdmin = computed(() => user.value?.role === 'super_admin')
  const isPaid = computed(() => user.value?.isPaid ?? false)

  async function login(username: string, password: string) {
    const { api } = useApi()
    const data = await api.post<{
      accessToken: string
      refreshToken: string
      user: User
    }>('/auth/login', { username, password })

    accessToken.value = data.accessToken
    refreshToken.value = data.refreshToken
    user.value = data.user

    // 持久化（SSR 安全）
    if (import.meta.client) {
      localStorage.setItem('seekall_access_token', data.accessToken)
      localStorage.setItem('seekall_refresh_token', data.refreshToken)
      localStorage.setItem('seekall_user', JSON.stringify(data.user))
    }
  }

  function register(payload: {
    inviteCode: string
    username: string
    email: string
    password: string
    agreementVersion: string
  }) {
    const { api } = useApi()
    return api.post('/auth/register', payload)
  }

  async function refresh() {
    if (!refreshToken.value) return
    try {
      // 用裸 $fetch 直接调用 refresh 接口，不能走 useApi（否则 401 会触发 useApi 内的 refresh 逻辑，导致无限递归）
      const config = useRuntimeConfig()
      const data = await $fetch<{ accessToken: string; refreshToken: string }>(
        `${config.public.apiBase}/auth/refresh`,
        {
          method: 'POST',
          body: { refreshToken: refreshToken.value },
        },
      )
      accessToken.value = data.accessToken
      refreshToken.value = data.refreshToken
      if (import.meta.client) {
        localStorage.setItem('seekall_access_token', data.accessToken)
        localStorage.setItem('seekall_refresh_token', data.refreshToken)
      }
    } catch {
      logout()
    }
  }

  function logout() {
    user.value = null
    accessToken.value = null
    refreshToken.value = null
    if (import.meta.client) {
      localStorage.removeItem('seekall_access_token')
      localStorage.removeItem('seekall_refresh_token')
      localStorage.removeItem('seekall_user')
    }
  }

  function loadFromStorage() {
    if (!import.meta.client) return
    const token = localStorage.getItem('seekall_access_token')
    const refresh = localStorage.getItem('seekall_refresh_token')
    const userStr = localStorage.getItem('seekall_user')
    if (token && refresh && userStr) {
      accessToken.value = token
      refreshToken.value = refresh
      user.value = JSON.parse(userStr)
    }
  }

  /** GitHub OAuth 登录用：直接设置 token */
  function setTokens(access: string, refresh: string) {
    accessToken.value = access
    refreshToken.value = refresh
    if (import.meta.client) {
      localStorage.setItem('seekall_access_token', access)
      localStorage.setItem('seekall_refresh_token', refresh)
    }
  }

  /** 获取用户资料（GitHub 登录用） */
  async function fetchProfile() {
    if (!accessToken.value) return
    try {
      const data = await $fetch<{
        data: {
          id: string
          username: string
          email: string
          role: string
          isPaid: boolean
          paidUntil: string | null
          status: string
          badge: string | null
          avatarUrl: string | null
        }
      }>('/api/v1/user/profile', {
        headers: { Authorization: `Bearer ${accessToken.value}` },
      })
      user.value = data.data
      if (import.meta.client) {
        localStorage.setItem('seekall_user', JSON.stringify(data.data))
      }
    } catch {
      // 忽略错误
    }
  }

  return {
    user,
    accessToken,
    refreshToken,
    isLoggedIn,
    isAdmin,
    isPaid,
    login,
    register,
    refresh,
    logout,
    loadFromStorage,
    setTokens,
    fetchProfile,
  }
})
