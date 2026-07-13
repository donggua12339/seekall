<template>
  <div class="container mx-auto px-4 py-8 max-w-2xl">
    <h1 class="text-2xl font-bold mb-6">个人主页</h1>

    <div v-if="user" class="space-y-6">
      <!-- 基本信息 -->
      <n-card title="基本信息">
        <div class="flex items-center gap-4">
          <n-avatar round size="large" :src="user.avatarUrl || undefined" />
          <div>
            <div class="flex items-center gap-2">
              <span class="text-lg font-semibold">{{ user.username }}</span>
              <n-tag v-if="user.isPaid" type="warning" size="small">赞助者</n-tag>
              <n-tag v-if="user.role === 'super_admin'" type="error" size="small">管理员</n-tag>
            </div>
            <div class="text-sm text-gray-500">{{ user.email }}</div>
            <div v-if="user.paidUntil" class="text-xs text-gray-400">
              会员到期：{{ new Date(user.paidUntil).toLocaleDateString() }}
            </div>
          </div>
        </div>
      </n-card>

      <!-- 会员激活 -->
      <n-card title="会员激活" v-if="!user.isPaid">
        <n-input-group>
          <n-input v-model:value="membershipCode" placeholder="输入会员激活码" />
          <n-button type="primary" :loading="activating" @click="activateMembership">
            激活
          </n-button>
        </n-input-group>
        <p class="text-xs text-gray-400 mt-2">
          会员激活码请通过 WM 发卡网购买
        </p>
      </n-card>

      <!-- 偏好设置 -->
      <n-card title="偏好设置">
        <n-form label-placement="left" :label-width="120">
          <n-form-item label="主题">
            <n-radio-group v-model:value="preferences.theme">
              <n-radio value="auto">跟随系统</n-radio>
              <n-radio value="light">浅色</n-radio>
              <n-radio value="dark">深色</n-radio>
            </n-radio-group>
          </n-form-item>
          <n-form-item label="每页结果数">
            <n-select v-model:value="preferences.searchPageSize" :options="pageSizeOptions" />
          </n-form-item>
          <n-form-item label="安全搜索">
            <n-switch v-model:value="preferences.safeSearch" />
          </n-form-item>
          <n-form-item label=" ">
            <n-button type="primary" :loading="saving" @click="savePreferences">
              保存
            </n-button>
          </n-form-item>
        </n-form>
      </n-card>

      <!-- 危险操作 -->
      <n-card title="危险操作">
        <n-button type="error" ghost @click="handleDeleteAccount">
          注销账号
        </n-button>
        <p class="text-xs text-gray-400 mt-2">
          注销后账号将进入 30 天保留期，期间用户名不可重新注册
        </p>
      </n-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  NCard, NAvatar, NTag, NInput, NInputGroup, NButton, NForm, NFormItem,
  NRadioGroup, NRadio, NSelect, NSwitch, useMessage, useDialog,
} from 'naive-ui'
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'

useHead({ title: '个人主页' })

const authStore = useAuthStore()
const { api } = useApi()
const message = useMessage()
const dialog = useDialog()

const user = ref(authStore.user)
const membershipCode = ref('')
const activating = ref(false)
const saving = ref(false)

const preferences = reactive({
  theme: 'auto',
  searchPageSize: 20,
  safeSearch: true,
})

const pageSizeOptions = [
  { label: '10 条/页', value: 10 },
  { label: '20 条/页', value: 20 },
  { label: '30 条/页', value: 30 },
  { label: '50 条/页', value: 50 },
]

onMounted(async () => {
  if (!authStore.isLoggedIn) {
    navigateTo('/auth/login')
    return
  }
  try {
    const data = await api.get('/user/profile')
    user.value = data as never
    if ((data as { preferences?: { theme?: string; searchPageSize?: number; safeSearch?: boolean } }).preferences) {
      const p = (data as { preferences: { theme?: string; searchPageSize?: number; safeSearch?: boolean } }).preferences
      preferences.theme = p.theme || 'auto'
      preferences.searchPageSize = p.searchPageSize || 20
      preferences.safeSearch = p.safeSearch ?? true
    }
  } catch (err) {
    message.error((err as Error).message)
  }
})

async function activateMembership() {
  if (!membershipCode.value) return
  activating.value = true
  try {
    await api.post('/user/membership/activate', { code: membershipCode.value })
    message.success('会员激活成功')
    membershipCode.value = ''
    // 刷新用户信息
    const data = await api.get('/user/profile')
    user.value = data as never
    authStore.user = data as never
    if (import.meta.client) {
      localStorage.setItem('seekall_user', JSON.stringify(data))
    }
  } catch (err) {
    message.error((err as Error).message)
  } finally {
    activating.value = false
  }
}

async function savePreferences() {
  saving.value = true
  try {
    await api.patch('/user/profile', { preferences })
    message.success('已保存')
  } catch (err) {
    message.error((err as Error).message)
  } finally {
    saving.value = false
  }
}

function handleDeleteAccount() {
  dialog.warning({
    title: '确认注销账号',
    content: '账号注销后将进入 30 天保留期，期间无法登录。确定要注销吗？',
    positiveText: '确认注销',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await api.delete('/user/account')
        authStore.logout()
        message.success('账号已注销')
        navigateTo('/')
      } catch (err) {
        message.error((err as Error).message)
      }
    },
  })
}
</script>
