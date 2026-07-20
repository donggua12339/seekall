<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import {
  NCard,
  NForm,
  NFormItem,
  NInput,
  NButton,
  NSpace,
  NText,
  useMessage,
} from 'naive-ui'

const router = useRouter()
const auth = useAuthStore()
const message = useMessage()

const form = reactive({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
})
const loading = ref(false)

async function handleSubmit() {
  if (!form.username || !form.email || !form.password) {
    message.warning('请填写所有字段')
    return
  }
  if (form.password !== form.confirmPassword) {
    message.error('两次密码不一致')
    return
  }
  if (form.password.length < 8) {
    message.error('密码至少 8 位')
    return
  }
  loading.value = true
  try {
    await auth.register(form.username, form.email, form.password)
    message.success('注册成功,已自动登录')
    router.push('/dashboard')
  } catch (err) {
    message.error(err instanceof Error ? err.message : '注册失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="register-container">
    <NCard class="register-card" title="注册 SeekAll 账号" size="large">
      <NForm @submit.prevent="handleSubmit">
        <NFormItem label="用户名">
          <NInput v-model:value="form.username" placeholder="3-20 位字符" />
        </NFormItem>
        <NFormItem label="邮箱">
          <NInput v-model:value="form.email" placeholder="用于验证和找回密码" />
        </NFormItem>
        <NFormItem label="密码">
          <NInput
            v-model:value="form.password"
            type="password"
            show-password-on="click"
            placeholder="至少 8 位"
          />
        </NFormItem>
        <NFormItem label="确认密码">
          <NInput
            v-model:value="form.confirmPassword"
            type="password"
            show-password-on="click"
            placeholder="再次输入密码"
          />
        </NFormItem>
        <NSpace vertical>
          <NButton type="primary" block :loading="loading" @click="handleSubmit">
            注册
          </NButton>
          <NText depth="3" style="font-size: 13px;">
            已有账号?
            <NButton text type="primary" @click="router.push('/login')">
              登录
            </NButton>
          </NText>
        </NSpace>
      </NForm>
    </NCard>
  </div>
</template>

<style scoped>
.register-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #3aa675 0%, #2d8054 100%);
}
.register-card {
  width: 420px;
  max-width: 90vw;
}
</style>
