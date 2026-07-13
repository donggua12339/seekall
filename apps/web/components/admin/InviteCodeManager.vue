<template>
  <div>
    <div class="flex-between mb-4">
      <n-space>
        <n-input-number v-model:value="generateCount" :min="1" :max="1000" placeholder="生成数量" />
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
const generating = ref(false)
const exporting = ref(false)
const loading = ref(false)
const codes = ref<unknown[]>([])
const pagination = reactive({ page: 1, pageSize: 20, itemCount: 0 })

const columns = [
  { title: 'ID', key: 'id' },
  { title: '邀请码', key: 'code' },
  { title: '状态', key: 'status' },
  { title: '创建者', key: 'createdBy.username' },
  { title: '使用者', key: 'usedBy.username' },
  {
    title: '操作',
    key: 'actions',
    render: (row: { id: bigint; status: string }) =>
      row.status === 'unused'
        ? h(NButton, { size: 'small', quaternary: true, onClick: () => disableCode(row.id) }, () => '禁用')
        : null,
  },
]

async function load() {
  loading.value = true
  try {
    const data = await api.get<{ list: unknown[]; total: number }>('/admin/invite-codes', {
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
    await api.post('/admin/invite-codes/generate', { count: generateCount.value })
    message.success(`已生成 ${generateCount.value} 个邀请码`)
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
    const codes = await api.get<{ code: string; createdAt: string }[]>('/admin/invite-codes/export')
    const csv = ['code,created_at', ...codes.map((c) => `${c.code},${c.createdAt}`)].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `invite-codes-${Date.now()}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success('已导出')
  } catch (err) {
    message.error((err as Error).message)
  } finally {
    exporting.value = false
  }
}

async function disableCode(id: bigint) {
  try {
    await api.patch(`/admin/invite-codes/${id}/disable`)
    message.success('已禁用')
    load()
  } catch (err) {
    message.error((err as Error).message)
  }
}

onMounted(load)
</script>
