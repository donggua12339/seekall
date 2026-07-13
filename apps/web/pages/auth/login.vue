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
