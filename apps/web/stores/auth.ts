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
    const data = await api.post('/auth/login', { username, password })

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

  async function register(payload: {
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
      const { api } = useApi()
      const data = await api.post('/auth/refresh', { refreshToken: refreshToken.value })
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
  }
})
