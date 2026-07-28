<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NCard,
  NForm,
  NFormItem,
  NInput,
  NButton,
  NSpace,
  NText,
  NAlert,
  useMessage,
} from 'naive-ui'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const message = useMessage()
const auth = useAuthStore()

const code = ref('')
const loading = ref(false)
const resending = ref(false)
const countdown = ref(0)
const mode = ref<'code' | 'link'>('code')

onMounted(async () => {
  try {
    const res = await authApi.getVerifyMode()
    mode.value = res.mode
  } catch {
    mode.value = 'code'
  }
  // 已验证则跳走
  if (auth.user?.emailVerifiedAt) {
    router.replace('/dashboard')
  }
})

async function handleVerify() {
  if (code.value.length !== 6) {
    message.warning('请输入 6 位验证码')
    return
  }
  loading.value = true
  try {
    await authApi.verifyEmailCode(code.value)
    message.success('邮箱验证成功')
    // 刷新用户信息
    const me = await authApi.me()
    auth.setUser(me)
    router.push('/dashboard')
  } catch (err) {
    message.error(err instanceof Error ? err.message : '验证码错误')
  } finally {
    loading.value = false
  }
}

async function handleResend() {
  if (countdown.value > 0) return
  resending.value = true
  try {
    await authApi.resendVerification()
    message.success('验证邮件已重新发送')
    countdown.value = 60
    const timer = setInterval(() => {
      countdown.value--
      if (countdown.value <= 0) clearInterval(timer)
    }, 1000)
  } catch (err) {
    message.error(err instanceof Error ? err.message : '发送失败')
  } finally {
    resending.value = false
  }
}
</script>

<template>
  <div class="verify-container">
    <NCard class="verify-card" title="邮箱验证" size="large">
      <NAlert v-if="mode === 'code'" type="info" style="margin-bottom: 20px">
        我们已向 <strong>{{ auth.user?.email }}</strong> 发送了 6 位验证码，请查收邮件。
      </NAlert>
      <NAlert v-else type="info" style="margin-bottom: 20px">
        我们已向 <strong>{{ auth.user?.email }}</strong> 发送了验证链接，请点击邮件中的链接完成验证。
      </NAlert>

      <NForm v-if="mode === 'code'" @submit.prevent="handleVerify">
        <NFormItem label="验证码">
          <NInput
            v-model:value="code"
            placeholder="输入 6 位验证码"
            maxlength="6"
            :input-props="{ inputmode: 'numeric', pattern: '[0-9]*' }"
          />
        </NFormItem>
        <NSpace vertical>
          <NButton type="primary" block :loading="loading" :disabled="code.length !== 6" @click="handleVerify">
            验证
          </NButton>
          <NButton text type="primary" :loading="resending" :disabled="countdown > 0" @click="handleResend">
            {{ countdown > 0 ? `${countdown}s 后可重发` : '没收到？重新发送' }}
          </NButton>
        </NSpace>
      </NForm>

      <NSpace v-else vertical align="center">
        <NButton text type="primary" :loading="resending" :disabled="countdown > 0" @click="handleResend">
          {{ countdown > 0 ? `${countdown}s 后可重发` : '没收到？重新发送验证链接' }}
        </NButton>
      </NSpace>

      <NText depth="3" style="font-size: 13px; margin-top: 16px; display: block;">
        验证码 10 分钟内有效。跳过验证也可正常使用，但验证后可获得更多信任标识。
      </NText>
      <NButton text type="primary" style="margin-top: 8px" @click="router.push('/dashboard')">
        稍后验证，先使用
      </NButton>
    </NCard>
  </div>
</template>

<style scoped>
.verify-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #3aa675 0%, #2d8054 100%);
}
.verify-card {
  width: 420px;
  max-width: 90vw;
}
</style>
