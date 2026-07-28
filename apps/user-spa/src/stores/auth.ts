import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi } from '@/api/auth'
import type { UserInfo } from '@/api/auth'

const ACCESS_TOKEN_KEY = 'sa_user_access'
const REFRESH_TOKEN_KEY = 'sa_user_refresh'
const USER_KEY = 'sa_user_user'

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

  async function login(username: string, password: string) {
    const res = await authApi.login({ username, password })
    accessToken.value = res.accessToken
    refreshToken.value = res.refreshToken
    user.value = res.user
    localStorage.setItem(ACCESS_TOKEN_KEY, res.accessToken)
    localStorage.setItem(REFRESH_TOKEN_KEY, res.refreshToken)
    localStorage.setItem(USER_KEY, JSON.stringify(res.user))
  }

  async function register(username: string, email: string, password: string): Promise<string> {
    const res = await authApi.register({ username, email, password, agreementVersion: '1.0.0' })
    // 注册不自动登录（需要邮箱验证），返回成功消息
    return res.message
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

  function setUser(u: UserInfo) {
    user.value = u
    localStorage.setItem(USER_KEY, JSON.stringify(u))
  }

  return {
    accessToken,
    refreshToken,
    user,
    isLoggedIn,
    login,
    register,
    logout,
    setTokens,
    setUser,
  }
})
