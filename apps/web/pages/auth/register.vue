<template>
  <div class="container mx-auto px-4 py-8 max-w-md">
    <n-card title="注册">
      <n-alert type="info" class="mb-4"> 注册需要邀请码，请通过 WM 发卡网购买后填写 </n-alert>

      <n-form ref="formRef" :model="form" :rules="rules" label-placement="top">
        <n-form-item label="邀请码" path="inviteCode">
          <n-input v-model:value="form.inviteCode" placeholder="8 位邀请码" maxlength="8" />
          <template #feedback>
            <span class="text-xs">
              没有邀请码？
              <a
                href="https://winmelon.cn/shop/main"
                target="_blank"
                rel="noopener noreferrer"
                class="text-indigo-500 hover:underline"
              >
                点击购买邀请码
              </a>
            </span>
          </template>
        </n-form-item>
        <n-form-item label="用户名" path="username">
          <n-input v-model:value="form.username" placeholder="3-32 字符，字母数字下划线" />
        </n-form-item>
        <n-form-item label="邮箱" path="email">
          <n-input v-model:value="form.email" placeholder="用于验证和密码重置" />
        </n-form-item>
        <n-form-item label="密码" path="password">
          <n-input
            v-model:value="form.password"
            type="password"
            placeholder="至少 8 位，含字母和数字"
          />
        </n-form-item>

        <n-checkbox v-model:checked="agreed" class="mb-4">
          我已阅读并同意
          <NuxtLink to="/agreement" target="_blank" class="text-indigo-500">用户协议</NuxtLink>
        </n-checkbox>

        <n-button
          type="primary"
          block
          :loading="loading"
          :disabled="!agreed"
          @click="handleRegister"
        >
          注册
        </n-button>
      </n-form>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { NCard, NForm, NFormItem, NInput, NButton, NCheckbox, NAlert, useMessage } from 'naive-ui'
import { ref, reactive } from 'vue'
import type { FormInst, FormRules } from 'naive-ui'
import { useAuthStore } from '~/stores/auth'

useHead({ title: '注册' })

const authStore = useAuthStore()
const message = useMessage()
const router = useRouter()

const formRef = ref<FormInst | null>(null)
const loading = ref(false)
const agreed = ref(false)

const form = reactive({
  inviteCode: '',
  username: '',
  email: '',
  password: '',
})

const rules: FormRules = {
  inviteCode: {
    required: true,
    validator: (_r, v) => /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/.test(v),
    message: '邀请码格式无效',
    trigger: 'blur',
  },
  username: {
    required: true,
    validator: (_r, v) => /^[a-zA-Z0-9_]{3,32}$/.test(v),
    message: '用户名 3-32 字符，只能包含字母、数字、下划线',
    trigger: 'blur',
  },
  email: {
    required: true,
    type: 'email',
    message: '邮箱格式无效',
    trigger: 'blur',
  },
  password: {
    required: true,
    validator: (_r, v) => v && v.length >= 8 && /[a-zA-Z]/.test(v) && /\d/.test(v),
    message: '密码至少 8 位，必须包含字母和数字',
    trigger: 'blur',
  },
}

async function handleRegister() {
  await formRef.value?.validate()
  if (!agreed.value) {
    message.warning('请先同意用户协议')
    return
  }
  loading.value = true
  try {
    await authStore.register({
      ...form,
      agreementVersion: '1.0.0',
    })
    message.success('注册成功，请查收邮件完成验证')
    router.push('/auth/login')
  } catch (err) {
    message.error((err as Error).message || '注册失败')
  } finally {
    loading.value = false
  }
}
</script>
