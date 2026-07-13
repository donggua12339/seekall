<template>
  <div>
    <div class="flex-between mb-4">
      <n-space>
        <n-input-number v-model:value="generateCount" :min="1" :max="1000" placeholder="数量" />
        <n-input-number v-model:value="durationDays" :min="1" :max="3650" placeholder="时长（天）" />
        <n-button type="primary" :loading="generating" @click="handleGenerate">
          批量生成
        </n-button>
      </n-space>
      <n-button @click="exportCodes" :loading="exporting">导出未使用（CSV）</n-button>
    </div>

    <n-data-table :columns="columns" :data="codes" :loading="loading" :pagination="pagination" />
  </div>
</template>

<script setup lang="ts">
import { NInputNumber, NButton, NDataTable, NSpace, useMessage } from 'naive-ui'
import { ref, reactive, onMounted, h } from 'vue'

const { api } = useApi()
const message = useMessage()

const generateCount = ref(10)
const durationDays = ref(30)
const generating = ref(false)
const exporting = ref(false)
const loading = ref(false)
const codes = ref<unknown[]>([])
const pagination = reactive({ page: 1, pageSize: 20, itemCount: 0 })

const columns = [
  { title: 'ID', key: 'id' },
  { title: '激活码', key: 'code' },
  { title: '时长（天）', key: 'durationDays' },
  { title: '状态', key: 'status' },
  { title: '使用者', key: 'usedBy.username' },
]

async function load() {
  loading.value = true
  try {
    const data = await api.get<{ list: unknown[]; total: number }>('/admin/membership-codes', {
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    codes.value = data.list
    pagination.itemCount = data.total
  } finally {
    loading.value = false
  }
}

async function handleGenerate() {
  generating.value = true
  try {
    await api.post('/admin/membership-codes/generate', {
      count: generateCount.value,
      durationDays: durationDays.value,
    })
    message.success(`已生成 ${generateCount.value} 个会员激活码`)
    load()
  } catch (err) {
    message.error((err as Error).message)
  } finally {
    generating.value = false
  }
}

async function exportCodes() {
  exporting.value = true
  try {
    const codes = await api.get<{ code: string; durationDays: number; createdAt: string }[]>('/admin/membership-codes/export')
    const csv = ['code,duration_days,created_at', ...codes.map((c) => `${c.code},${c.durationDays},${c.createdAt}`)].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `membership-codes-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success('已导出')
  } catch (err) {
    message.error((err as Error).message)
  } finally {
    exporting.value = false
  }
}

onMounted(load)
</script>
