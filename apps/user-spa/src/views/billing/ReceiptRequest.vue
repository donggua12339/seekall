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
  NDescriptions,
  NDescriptionsItem,
  useMessage,
} from 'naive-ui'
import { billingApi, type Receipt } from '@/api/billing'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const loading = ref(false)
const receipt = ref<Receipt | null>(null)

const form = reactive({
  licenseCode: (route.query.code as string) || '',
  title: '',
  email: '',
})

onMounted(() => {
  if (!form.licenseCode) {
    message.warning('请从交易记录进入')
    router.push('/transactions')
  }
})

async function handleSubmit() {
  if (!form.licenseCode || !form.title || !form.email) {
    message.warning('请填写所有字段')
    return
  }
  loading.value = true
  try {
    receipt.value = await billingApi.requestReceipt(form)
    message.success('收据已生成')
  } catch (err) {
    message.error(err instanceof Error ? err.message : '申请失败')
  } finally {
    loading.value = false
  }
}

function handlePrint() {
  window.print()
}
</script>

<template>
  <NCard title="申请电子收据">
    <NAlert type="warning" style="margin-bottom: 16px;" :bordered="false">
      <NText strong>电子收据 ≠ 税务发票</NText>
      <NText depth="3" style="display: block; margin-top: 4px;">
        本收据仅供报销参考,不是正规税务发票。如需正规发票,请联系客服。
      </NText>
    </NAlert>

    <NForm v-if="!receipt" label-placement="top">
      <NFormItem label="License Code">
        <NInput v-model:value="form.licenseCode" disabled />
      </NFormItem>
      <NFormItem label="收据抬头" required>
        <NInput v-model:value="form.title" placeholder="个人姓名 或 公司名称" />
      </NFormItem>
      <NFormItem label="接收邮箱" required>
        <NInput v-model:value="form.email" placeholder="your@email.com" />
      </NFormItem>
      <NButton type="primary" :loading="loading" @click="handleSubmit">
        生成收据
      </NButton>
    </NForm>

    <div v-else>
      <NDescriptions bordered :column="1" label-placement="left">
        <NDescriptionsItem label="收据编号">
          <NText code>{{ receipt.receiptId }}</NText>
        </NDescriptionsItem>
        <NDescriptionsItem label="License Code">
          {{ receipt.licenseCode }}
        </NDescriptionsItem>
        <NDescriptionsItem label="档位">
          {{ receipt.tierLabel }}
        </NDescriptionsItem>
        <NDescriptionsItem label="金额">
          ¥{{ receipt.amount }}
        </NDescriptionsItem>
        <NDescriptionsItem label="抬头">
          {{ receipt.title }}
        </NDescriptionsItem>
        <NDescriptionsItem label="邮箱">
          {{ receipt.email }}
        </NDescriptionsItem>
        <NDescriptionsItem label="付款时间">
          {{ new Date(receipt.paidAt).toLocaleString('zh-CN') }}
        </NDescriptionsItem>
        <NDescriptionsItem label="开具时间">
          {{ new Date(receipt.issuedAt).toLocaleString('zh-CN') }}
        </NDescriptionsItem>
      </NDescriptions>

      <NAlert type="info" style="margin-top: 16px;" :bordered="false">
        {{ receipt.disclaimer }}
      </NAlert>

      <NSpace style="margin-top: 16px;">
        <NButton @click="router.push('/transactions')">返回交易记录</NButton>
        <NButton type="primary" @click="handlePrint">打印收据</NButton>
      </NSpace>
    </div>
  </NCard>
</template>
