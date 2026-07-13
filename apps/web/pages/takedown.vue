<template>
  <div class="container mx-auto px-4 py-8 max-w-2xl">
    <h1 class="text-2xl font-bold mb-6">侵权举报</h1>

    <n-card>
      <n-alert type="warning" class="mb-4">
        本站仅做链接聚合，不存储任何文件内容。如发现侵权内容，请提交举报，我们将在 24 小时内处理。
      </n-alert>

      <n-form ref="formRef" :model="form" :rules="rules" label-placement="top">
        <n-form-item label="您的邮箱" path="reporterEmail">
          <n-input v-model:value="form.reporterEmail" placeholder="便于我们回复处理结果" />
        </n-form-item>
        <n-form-item label="侵权资源链接" path="resourceUrl">
          <n-input v-model:value="form.resourceUrl" placeholder="https://..." />
        </n-form-item>
        <n-form-item label="举报理由" path="reason">
          <n-input
            v-model:value="form.reason"
            type="textarea"
            :rows="4"
            placeholder="详细描述侵权理由，如版权方、原作品信息等"
          />
        </n-form-item>
        <n-button type="primary" :loading="loading" @click="handleSubmit"> 提交举报 </n-button>
      </n-form>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { NCard, NForm, NFormItem, NInput, NButton, NAlert, useMessage } from 'naive-ui'
import { ref, reactive } from 'vue'
import type { FormInst, FormRules } from 'naive-ui'

useHead({ title: '侵权举报' })

const { api } = useApi()
const message = useMessage()

const formRef = ref<FormInst | null>(null)
const loading = ref(false)

const form = reactive({
  reporterEmail: '',
  resourceUrl: '',
  reason: '',
})

const rules: FormRules = {
  reporterEmail: { required: true, type: 'email', message: '邮箱格式无效', trigger: 'blur' },
  resourceUrl: { required: true, type: 'url', message: 'URL 格式无效', trigger: 'blur' },
  reason: { required: true, message: '请填写举报理由', trigger: 'blur' },
}

async function handleSubmit() {
  await formRef.value?.validate()
  loading.value = true
  try {
    await api.post('/takedown/report', form)
    message.success('举报已提交，将在 24 小时内处理')
    form.reporterEmail = ''
    form.resourceUrl = ''
    form.reason = ''
  } catch (err) {
    message.error((err as Error).message)
  } finally {
    loading.value = false
  }
}
</script>
