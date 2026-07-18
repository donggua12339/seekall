<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const message = useMessage()
const auth = useAuthStore()

const loading = ref(false)
const form = reactive({
  username: '',
  password: '',
})

async function handleSubmit() {
  if (!form.username || !form.password) {
    message.warning('请填写用户名和密码')
    return
  }
  loading.value = true
  try {
    await auth.login(form.username, form.password)
    if (!auth.isSuperAdmin) {
      message.error('非管理员账号，禁止登录')
      auth.logout()
      return
    }
    message.success('登录成功')
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.push(redirect)
  } catch (err) {
    message.error((err as Error).message || '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="logo">
        <img src="/favicon.svg" alt="logo" width="48" height="48" />
        <h1>SeekAll Admin</h1>
      </div>
      <p class="subtitle">super_admin 后台管理</p>

      <n-form @submit.prevent="handleSubmit">
        <n-form-item label="用户名">
          <n-input
            v-model:value="form.username"
            placeholder="admin"
            :input-props="{ autocomplete: 'username' }"
          />
        </n-form-item>
        <n-form-item label="密码">
          <n-input
            v-model:value="form.password"
            type="password"
            show-password-on="click"
            placeholder="••••••••"
            :input-props="{ autocomplete: 'current-password' }"
            @keyup.enter="handleSubmit"
          />
        </n-form-item>
        <n-button
          type="primary"
          block
          :loading="loading"
          attr-type="submit"
          @click="handleSubmit"
        >
          登录
        </n-button>
      </n-form>

      <p class="footer">
        <a href="https://seekall.winmelon.cn" target="_blank">主站</a>
        ·
        <a href="https://github.com/donggua12339/seekall" target="_blank">GitHub</a>
      </p>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #3aa675 0%, #2d8959 100%);
}
.login-card {
  background: #fff;
  padding: 40px;
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  width: 360px;
}
.logo {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.logo h1 {
  margin: 0;
  font-size: 22px;
  color: #1f2937;
}
.subtitle {
  color: #6b7280;
  margin: 0 0 24px 0;
  font-size: 13px;
}
.footer {
  text-align: center;
  margin-top: 24px;
  color: #9ca3af;
  font-size: 12px;
}
.footer a {
  color: #6b7280;
}
.footer a:hover {
  color: #3aa675;
}
</style>
