<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  NCard,
  NForm,
  NFormItem,
  NRadioGroup,
  NRadio,
  NButton,
  NSpace,
  NText,
  useMessage,
} from 'naive-ui'
import { adminApi } from '@/api/admin'

const message = useMessage()
const loading = ref(false)
const mode = ref<'code' | 'link'>('code')

onMounted(async () => {
  try {
    const res = await adminApi.getEmailVerifyMode()
    mode.value = res.mode as 'code' | 'link'
  } catch {
    mode.value = 'code'
  }
})

async function handleSave() {
  loading.value = true
  try {
    await adminApi.setEmailVerifyMode(mode.value)
    message.success(`已切换为「${mode.value === 'code' ? '验证码' : '验证链接'}」模式`)
  } catch (err) {
    message.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <NCard title="系统设置">
    <NForm style="max-width: 600px">
      <NFormItem label="邮箱验证模式">
        <NRadioGroup v-model:value="mode">
          <NSpace vertical>
            <NRadio value="code">
              <NSpace vertical :size="2">
                <NText strong>验证码模式（默认）</NText>
                <NText depth="3" style="font-size: 12px">
                  发送 6 位数字验证码到邮箱，用户在验证页输入即可。10 分钟有效。
                </NText>
              </NSpace>
            </NRadio>
            <NRadio value="link">
              <NSpace vertical :size="2">
                <NText strong>验证链接模式</NText>
                <NText depth="3" style="font-size: 12px">
                  发送包含验证链接的邮件，用户点击链接完成验证。30 分钟有效。
                </NText>
              </NSpace>
            </NRadio>
          </NSpace>
        </NRadioGroup>
      </NFormItem>
      <NButton type="primary" :loading="loading" @click="handleSave">
        保存
      </NButton>
    </NForm>
  </NCard>
</template>
