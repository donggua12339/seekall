<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import {
  NCard,
  NDataTable,
  NTag,
  NButton,
  NSpace,
  NStatistic,
  NGrid,
  NGridItem,
  NSpin,
  NEmpty,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { billingApi, type Transaction } from '@/api/billing'

const message = useMessage()
const loading = ref(true)
const transactions = ref<Transaction[]>([])

async function load() {
  loading.value = true
  try {
    transactions.value = await billingApi.transactions()
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)

const totalAmount = ref(0)
function calcTotal() {
  totalAmount.value = transactions.value.reduce((sum, t) => sum + t.amount, 0)
}
import { watch } from 'vue'
watch(transactions, calcTotal, { deep: true })

const tierTagType = (tier: string): 'default' | 'success' | 'warning' | 'error' => {
  if (tier === 'trial') return 'warning'
  if (tier === 'monthly') return 'success'
  if (tier === 'lifetime') return 'error'
  return 'default'
}

const columns: DataTableColumns<Transaction> = [
  {
    title: 'License Code',
    key: 'licenseCode',
    render: (row) => h('code', null, row.licenseCode),
  },
  {
    title: '档位',
    key: 'tier',
    width: 120,
    render: (row) => h(NTag, { size: 'small', type: tierTagType(row.tier) }, () => row.tierLabel),
  },
  {
    title: '金额',
    key: 'amount',
    width: 100,
    render: (row) => `¥${row.amount}`,
  },
  {
    title: 'WM 订单号',
    key: 'wmOrderId',
    width: 180,
    render: (row) => row.wmOrderId || h('span', { style: 'color: #999' }, '-'),
  },
  {
    title: '付款时间',
    key: 'paidAt',
    width: 180,
    render: (row) => new Date(row.paidAt).toLocaleString('zh-CN'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    render: (row) =>
      h(NSpace, () => [
        h(
          NButton,
          {
            size: 'small',
            quaternary: true,
            type: 'primary',
            onClick: () => goReceipt(row.licenseCode),
          },
          () => '收据',
        ),
        h(
          NButton,
          {
            size: 'small',
            quaternary: true,
            type: 'warning',
            onClick: () => goRefund(row.licenseCode),
          },
          () => '退款',
        ),
      ]),
  },
]

import { useRouter } from 'vue-router'
const router = useRouter()
function goReceipt(code: string) {
  router.push({ path: '/receipts/request', query: { code } })
}
function goRefund(code: string) {
  router.push({ path: '/refunds/request', query: { code } })
}
</script>

<template>
  <NSpin :show="loading">
    <NGrid :cols="2" :x-gap="16" :y-gap="16" style="margin-bottom: 16px;">
      <NGridItem>
        <NCard>
          <NStatistic label="交易笔数" :value="transactions.length" />
        </NCard>
      </NGridItem>
      <NGridItem>
        <NCard>
          <NStatistic label="累计消费" :value="totalAmount" :precision="2">
            <template #prefix>¥</template>
          </NStatistic>
        </NCard>
      </NGridItem>
    </NGrid>

    <NCard title="交易记录">
      <NDataTable
        v-if="transactions.length > 0"
        :columns="columns"
        :data="transactions"
        :bordered="false"
        striped
      />
      <NEmpty v-else description="暂无交易记录">
        <template #extra>
          <NButton type="primary" @click="$router.push('/licenses')">
            去激活 License
          </NButton>
        </template>
      </NEmpty>
    </NCard>
  </NSpin>
</template>
