import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/auth'
import type { UserInfo } from '@/api/auth'

const ACCESS_TOKEN_KEY = 'sa_admin_access'
const REFRESH_TOKEN_KEY = 'sa_admin_refresh'
const USER_KEY = 'sa_admin_user'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string>(localStorage.getItem(ACCESS_TOKEN_KEY) || '')
  const refreshToken = ref<string>(localStorage.getItem(REFRESH_TOKEN_KEY) || '')
  const user = ref<UserInfo | null>(
    (() => {
      const raw = localStorage.getItem(USER_KEY)
      return raw ? (JSON.parse(raw) as UserInfo) : null
    })(),
  )

  const isLoggedIn = computed(() => !!accessToken.value)
  const isSuperAdmin = computed(() => user.value?.role === 'super_admin')

  async function login(username: string, password: string) {
    const res = await authApi.login({ username, password })
    accessToken.value = res.accessToken
    refreshToken.value = res.refreshToken
    user.value = res.user
    localStorage.setItem(ACCESS_TOKEN_KEY, res.accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken)
    localStorage.setItem(USER_KEY, JSON.stringify(res.user))
  }

  function logout() {
    accessToken.value = ''
    refreshToken.value = ''
    user.value = null
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  function setTokens(access: string, refresh: string) {
    accessToken.value = access
    refreshToken.value = refresh
    localStorage.setItem(ACCESS_TOKEN_KEY, access)
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
  }

  return {
    accessToken,
    refreshToken,
    user,
    isLoggedIn,
    isSuperAdmin,
    login,
    logout,
    setTokens,
  }
})
