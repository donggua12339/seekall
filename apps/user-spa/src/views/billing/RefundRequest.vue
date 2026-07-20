<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NCard,
  NForm,
  NFormItem,
  NInput,
  NButton,
  NSpace,
  NText,
  NAlert,
  NList,
  NListItem,
  NThing,
  NTime,
  NTag,
  useMessage,
} from 'naive-ui'
import { billingApi, type Refund } from '@/api/billing'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const loading = ref(false)
const refunds = ref<Refund[]>([])

const form = reactive({
  licenseCode: (route.query.code as string) || '',
  reason: '',
})

async function loadRefunds() {
  try {
    refunds.value = await billingApi.myRefunds()
  } catch {
    // 静默
  }
}

onMounted(() => {
  loadRefunds()
  if (!form.licenseCode) {
    message.warning('请从交易记录进入')
    router.push('/transactions')
  }
})

async function handleSubmit() {
  if (!form.licenseCode || !form.reason) {
    message.warning('请填写退款原因')
    return
  }
  loading.value = true
  try {
    await billingApi.requestRefund(form)
    message.success('退款申请已提交,等待 admin 审核')
    await loadRefunds()
    router.push('/transactions')
  } catch (err) {
    message.error(err instanceof Error ? err.message : '申请失败')
  } finally {
    loading.value = false
  }
}

const statusTagType = (status: string): 'default' | 'warning' | 'success' | 'error' => {
  if (status === 'pending') return 'warning'
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'error'
  return 'default'
}
</script>

<template>
  <NCard title="申请退款">
    <NAlert type="warning" style="margin-bottom: 16px;" :bordered="false">
      <NText strong>退款规则</NText>
      <ul style="margin: 8px 0 0; padding-left: 20px;">
        <li>购买后 7 天内可申请退款</li>
        <li>退款需 admin 审核(1-3 个工作日)</li>
        <li>审核通过后,原路退回 WM 发卡网,由 WM 处理退款</li>
        <li>已大量使用的 license 可能被拒</li>
      </ul>
    </NAlert>

    <NForm label-placement="top">
      <NFormItem label="License Code">
        <NInput v-model:value="form.licenseCode" disabled />
      </NFormItem>
      <NFormItem label="退款原因" required>
        <NInput
          v-model:value="form.reason"
          type="textarea"
          placeholder="请说明退款原因(如:买错档位 / 不满意 / 其他)"
          :autosize="{ minRows: 3, maxRows: 6 }"
        />
      </NFormItem>
      <NSpace>
        <NButton type="warning" :loading="loading" @click="handleSubmit">
          提交退款申请
        </NButton>
        <NButton @click="router.back()">取消</NButton>
      </NSpace>
    </NForm>

    <NCard v-if="refunds.length > 0" title="我的退款申请" style="margin-top: 24px;" size="small">
      <NList bordered>
        <NListItem v-for="r in refunds" :key="r.id">
          <NThing>
            <template #header>
              <NText code>{{ r.licenseCode }}</NText>
              <NTag :type="statusTagType(r.status)" size="small" style="margin-left: 8px;">
                {{ r.status }}
              </NTag>
            </template>
            <template #description>
              <NTime :time="new Date(r.createdAt)" type="datetime" />
              <span style="margin-left: 8px;">{{ r.reason }}</span>
            </template>
          </NThing>
        </NListItem>
      </NList>
    </NCard>
  </NCard>
</template>
