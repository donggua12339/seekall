<script setup lang="ts">
import { ref, reactive } from 'vue'
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
  NSteps,
  NStep,
  useMessage,
} from 'naive-ui'
import { licenseApi } from '@/api/license'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const message = useMessage()
const auth = useAuthStore()
const loading = ref(false)

const form = reactive({
  code: '',
})

async function handleRedeem() {
  if (!form.code) {
    message.warning('请输入 license code')
    return
  }
  loading.value = true
  try {
    const res = await licenseApi.redeem(form.code)
    message.success(`续期成功!当前档位: ${res.user.tier}`)
    if (auth.user) {
      auth.setUser({
        ...auth.user,
        isPaid: res.user.isPaid,
        tier: res.user.tier as 'trial' | 'monthly' | 'lifetime' | undefined,
      })
    }
    router.push('/dashboard')
  } catch (err) {
    message.error(err instanceof Error ? err.message : '续期失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <NCard title="续费 / 兑换 License">
    <NAlert type="info" style="margin-bottom: 16px;" :bordered="false">
      <NText strong>续费流程</NText>
      <NText depth="3" style="display: block; margin-top: 4px;">
        SeekAll 不支持站内付款。请到 WM 发卡网购买新 license code,然后在下方输入 code 续期。
      </NText>
    </NAlert>

    <NSteps :current="2" style="margin-bottom: 24px;">
      <NStep title="购买 license code" description="到 WM 发卡网下单付款" />
      <NStep title="输入 code 续期" description="在下方输入新的 license code" />
      <NStep title="激活成功" description="会员档位 + 到期时间更新" />
    </NSteps>

    <NForm label-placement="top">
      <NFormItem label="新 License Code" required>
        <NInput
          v-model:value="form.code"
          placeholder="SA-TRY-xxxx / SA-MON-xxxx / SA-LIF-xxxx"
        />
      </NFormItem>
      <NSpace>
        <NButton type="primary" :loading="loading" @click="handleRedeem">
          续期
        </NButton>
        <NButton @click="router.back()">取消</NButton>
      </NSpace>
    </NForm>
  </NCard>
</template>
