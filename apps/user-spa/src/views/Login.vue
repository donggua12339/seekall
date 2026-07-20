<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
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
const route = useRoute()
const auth = useAuthStore()
const message = useMessage()

const form = reactive({
  username: '',
  password: '',
})
const loading = ref(false)

async function handleSubmit() {
  if (!form.username || !form.password) {
    message.warning('请填写用户名和密码')
    return
  }
  loading.value = true
  try {
    await auth.login(form.username, form.password)
    message.success('登录成功')
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.push(redirect)
  } catch (err) {
    message.error(err instanceof Error ? err.message : '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <NCard class="login-card" title="SeekAll 用户中心" size="large">
      <NForm @submit.prevent="handleSubmit">
        <NFormItem label="用户名">
          <NInput
            v-model:value="form.username"
            placeholder="输入用户名"
            @keyup.enter="handleSubmit"
          />
        </NFormItem>
        <NFormItem label="密码">
          <NInput
            v-model:value="form.password"
            type="password"
            show-password-on="click"
            placeholder="输入密码"
            @keyup.enter="handleSubmit"
          />
        </NFormItem>
        <NSpace vertical>
          <NButton type="primary" block :loading="loading" @click="handleSubmit">
            登录
          </NButton>
          <NSpace justify="space-between" align="center">
            <NText depth="3" style="font-size: 13px;">
              还没账号?
              <NButton text type="primary" @click="router.push('/register')">
                注册
              </NButton>
            </NText>
            <NButton text type="primary" size="small" @click="router.push('/forgot-password')">
              忘记密码?
            </NButton>
          </NSpace>
        </NSpace>
      </NForm>
    </NCard>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #3aa675 0%, #2d8054 100%);
}
.login-card {
  width: 400px;
  max-width: 90vw;
}
</style>
