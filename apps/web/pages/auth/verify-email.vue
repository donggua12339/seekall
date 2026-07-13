<template>
  <div class="container mx-auto px-4 py-8 max-w-md">
    <n-card title="邮箱验证">
      <div v-if="status === 'pending'" class="text-center py-8">
        <n-spin size="large" />
        <p class="mt-4 text-gray-500">正在验证邮箱...</p>
      </div>
      <n-result
        v-else-if="status === 'success'"
        status="success"
        title="验证成功"
        description="邮箱已验证，现在可以登录了"
      >
        <template #footer>
          <n-button type="primary" @click="router.push('/auth/login')">去登录</n-button>
        </template>
      </n-result>
      <n-result v-else status="error" title="验证失败" :description="errorMsg">
        <template #footer>
          <n-button @click="router.push('/auth/register')">返回注册</n-button>
        </template>
      </n-result>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { NCard, NSpin, NResult, NButton } from 'naive-ui'
import { ref, onMounted } from 'vue'

useHead({ title: '邮箱验证' })

const route = useRoute()
const router = useRouter()
const { api } = useApi()

const status = ref<'pending' | 'success' | 'error'>('pending')
const errorMsg = ref('验证链接无效或已过期')

onMounted(async () => {
  const token = route.query.token as string
  if (!token) {
    status.value = 'error'
    return
  }
  try {
    await api.post('/auth/verify-email', { token })
    status.value = 'success'
  } catch (err) {
    status.value = 'error'
    errorMsg.value = (err as Error).message || '验证失败'
  }
})
</script>
