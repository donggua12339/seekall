<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import {
  NCard,
  NButton,
  NSpace,
  NDataTable,
  NTag,
  NSpin,
  NEmpty,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { ruleApi, type Rule, riskLevelToNum } from '@/api/rule'

const message = useMessage()
const loading = ref(true)
const subscriptions = ref<Rule[]>([])

async function loadSubscriptions() {
  loading.value = true
  try {
    const res = await ruleApi.mySubscriptions()
    subscriptions.value = Array.isArray(res) ? res : []
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function handleUnsubscribe(rule: Rule) {
  try {
    await ruleApi.unsubscribe(rule.id)
    subscriptions.value = subscriptions.value.filter((r) => r.id !== rule.id)
    message.success(`已取消订阅: ${rule.npmPackage}`)
  } catch (err) {
    message.error(err instanceof Error ? err.message : '取消订阅失败')
  }
}

onMounted(loadSubscriptions)

const riskTagType = (level: number): 'success' | 'info' | 'warning' | 'error' => {
  if (level === 0) return 'success'
  if (level === 1) return 'info'
  if (level === 2) return 'warning'
  return 'error'
}

const columns: DataTableColumns<Rule> = [
  {
    title: 'npm 包名',
    key: 'npmPackage',
  },
  {
    title: '风险',
    key: 'riskLevel',
    width: 80,
    render: (row) => { const n = riskLevelToNum(row.riskLevel); return h(NTag, { size: 'small', type: riskTagType(n), bordered: false }, () => `L${n}`) },
  },
  {
    title: '描述',
    key: 'description',
    ellipsis: { tooltip: true },
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    render: (row) =>
      h(NButton, { size: 'small', type: 'error', quaternary: true, onClick: () => handleUnsubscribe(row) }, () => '取消订阅'),
  },
]
</script>

<template>
  <NCard title="我的订阅">
    <template #header-extra>
      <NButton @click="$router.push('/rules')">发现更多规则</NButton>
    </template>

    <NSpin :show="loading">
      <NDataTable
        v-if="subscriptions.length > 0"
        :columns="columns"
        :data="subscriptions"
        :bordered="false"
        striped
      />
      <NEmpty v-else description="暂无订阅规则">
        <template #extra>
          <NButton type="primary" @click="$router.push('/rules')">
            浏览规则市场
          </NButton>
        </template>
      </NEmpty>
    </NSpin>
  </NCard>
</template>
