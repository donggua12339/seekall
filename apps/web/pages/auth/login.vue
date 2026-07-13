<template>
  <div class="container mx-auto px-4 py-8 max-w-md">
    <n-card title="登录">
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="top">
        <n-form-item label="用户名" path="username">
          <n-input v-model:value="form.username" placeholder="用户名" />
        </n-form-item>
        <n-form-item label="密码" path="password">
          <n-input v-model:value="form.password" type="password" placeholder="密码" @keyup.enter="handleLogin" />
        </n-form-item>
        <div class="flex justify-between items-center mb-4">
          <NuxtLink to="/auth/reset-password" class="text-sm text-indigo-500">忘记密码？</NuxtLink>
          <NuxtLink to="/auth/register" class="text-sm text-indigo-500">没有账号？注册</NuxtLink>
        </div>
        <n-button type="primary" block :loading="loading" @click="handleLogin">
          登录
        </n-button>

        <!-- GitHub OAuth 登录 -->
        <n-divider style="margin: 16px 0">或</n-divider>
        <n-button block @click="handleGithubLogin">
          <span class="flex-center gap-2">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            GitHub 登录
          </span>
        </n-button>
      </n-form>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { NCard, NForm, NFormItem, NInput, NButton, useMessage } from 'naive-ui'
import { ref, reactive } from 'vue'
import type { FormInst, FormRules } from 'naive-ui'
import { useAuthStore } from '~/stores/auth'

useHead({ title: '登录' })

const authStore = useAuthStore()
const message = useMessage()
const router = useRouter()

const formRef = ref<FormInst | null>(null)
const loading = ref(false)

const form = reactive({
  username: '',
  password: '',
})

function handleGithubLogin() {
  // 重定向到后端 GitHub OAuth 端点
  window.location.href = '/api/v1/auth/github'
}

const rules: FormRules = {
  username: { required: true, message: '请输入用户名', trigger: 'blur' },
  password: { required: true, message: '请输入密码', trigger: 'blur' },
}

async function handleLogin() {
  await formRef.value?.validate()
  loading.value = true
  try {
    await authStore.login(form.username, form.password)
    message.success('登录成功')
    router.push('/')
  } catch (err) {
    message.error((err as Error).message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>
