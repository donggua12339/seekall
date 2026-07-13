<template>
  <div class="container mx-auto px-4 py-16 max-w-md">
    <n-card>
      <div v-if="loading" class="text-center">
        <n-spin size="large" />
        <p class="mt-4 text-gray-600">正在完成 GitHub 登录...</p>
      </div>
      <div v-else-if="error" class="text-center">
        <p class="text-red-500">{{ error }}</p>
        <n-button class="mt-4" @click="router.push('/auth/login')">返回登录</n-button>
      </div>
      <div v-else class="text-center">
        <p class="text-green-500">登录成功！</p>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { NCard, NSpin, NButton, useMessage } from 'naive-ui'
import { ref, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'

useHead({ title: 'GitHub 登录' })

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const message = useMessage()

const loading = ref(true)
const error = ref('')

onMounted(async () => {
  const token = route.query.token as string
  const refreshToken = route.query.refresh as string

  if (!token || !refreshToken) {
    error.value = '登录回调参数缺失'
    loading.value = false
    return
  }

  try {
    await authStore.setTokens(token, refreshToken)
    await authStore.fetchProfile()
    message.success('登录成功')
    router.push('/')
  } catch (err) {
    error.value = (err as Error).message || '登录失败'
  } finally {
    loading.value = false
  }
})
</script>
