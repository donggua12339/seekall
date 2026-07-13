<template>
  <div class="container mx-auto px-4 py-8 max-w-md">
    <n-card title="忘记密码">
      <n-form ref="formRef" :model="form" :rules="rules" label-placement="top">
        <n-form-item label="邮箱" path="email">
          <n-input v-model:value="form.email" placeholder="注册时填写的邮箱" />
        </n-form-item>
        <n-button type="primary" block :loading="loading" @click="handleRequest">
          发送重置邮件
        </n-button>
        <div class="mt-4 text-center">
          <NuxtLink to="/auth/login" class="text-sm text-indigo-500">返回登录</NuxtLink>
        </div>
      </n-form>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { NCard, NForm, NFormItem, NInput, NButton, useMessage } from 'naive-ui'
import { ref, reactive } from 'vue'
import type { FormInst, FormRules } from 'naive-ui'

useHead({ title: '忘记密码' })

const { api } = useApi()
const message = useMessage()

const formRef = ref<FormInst | null>(null)
const loading = ref(false)

const form = reactive({ email: '' })
const rules: FormRules = {
  email: { required: true, type: 'email', message: '邮箱格式无效', trigger: 'blur' },
}

async function handleRequest() {
  await formRef.value?.validate()
  loading.value = true
  try {
    await api.post('/auth/password-reset/request', { email: form.email })
    message.success('如该邮箱已注册，将收到重置邮件')
  } catch (err) {
    message.error((err as Error).message)
  } finally {
    loading.value = false
  }
}
</script>
