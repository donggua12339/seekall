<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import {
  NCard,
  NForm,
  NFormItem,
  NInput,
  NSelect,
  NButton,
  NSpace,
  NText,
  NAlert,
  useMessage,
} from 'naive-ui'
import { ruleApi } from '@/api/rule'

const router = useRouter()
const message = useMessage()
const loading = ref(false)

const form = reactive({
  npmPackage: '',
  riskLevel: 0 as 0 | 1 | 2,
  description: '',
})

const riskOptions = [
  { label: 'L0 - 学术纯净(arxiv/crossref/pubmed)', value: 0 },
  { label: 'L1 - 通用开源(GitHub API 等)', value: 1 },
  { label: 'L2 - 社区评审(需付费会员评审)', value: 2 },
]

async function handleSubmit() {
  if (!form.npmPackage || !form.description) {
    message.warning('请填写 npm 包名和描述')
    return
  }
  if (!form.npmPackage.startsWith('@') && !form.npmPackage.match(/^[a-z0-9-]+$/)) {
    message.error('npm 包名格式错误(应为 @scope/name 或 name)')
    return
  }
  loading.value = true
  try {
    const rule = await ruleApi.submit(form)
    message.success(`规则提交成功: ${rule.npmPackage}`)
    router.push('/rules')
  } catch (err) {
    message.error(err instanceof Error ? err.message : '提交失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <NCard title="提交规则">
    <NAlert type="info" style="margin-bottom: 16px;" :bordered="false">
      <NText>规则提交后:</NText>
      <ul style="margin: 8px 0 0; padding-left: 20px;">
        <li>L0/L1 自动上架,立即可见</li>
        <li>L2 进入评审队列,需 ≥3 个付费会员赞成 + admin 终审</li>
        <li>L3/L4 仅 admin 可创建,用户不可提交</li>
      </ul>
    </NAlert>

    <NForm label-placement="top">
      <NFormItem label="npm 包名" required>
        <NInput
          v-model:value="form.npmPackage"
          placeholder="@scope/rule-name 或 rule-name"
        />
      </NFormItem>
      <NFormItem label="风险等级" required>
        <NSelect v-model:value="form.riskLevel" :options="riskOptions" />
      </NFormItem>
      <NFormItem label="描述" required>
        <NInput
          v-model:value="form.description"
          type="textarea"
          placeholder="一句话描述规则用途,如:搜索 arxiv 学术论文"
          :autosize="{ minRows: 2, maxRows: 5 }"
        />
      </NFormItem>
      <NFormItem>
        <NSpace>
          <NButton type="primary" :loading="loading" @click="handleSubmit">
            提交
          </NButton>
          <NButton @click="router.back()">取消</NButton>
        </NSpace>
      </NFormItem>
    </NForm>
  </NCard>
</template>
