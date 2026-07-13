<template>
  <div>
    <n-data-table :columns="columns" :data="records" :loading="loading" :pagination="pagination" />
  </div>
</template>

<script setup lang="ts">
import { NDataTable, NButton, useMessage } from 'naive-ui'
import { ref, reactive, onMounted, h } from 'vue'

const { api } = useApi()
const message = useMessage()

const loading = ref(false)
const records = ref<unknown[]>([])
const pagination = reactive({ page: 1, pageSize: 20, itemCount: 0 })

const columns = [
  { title: 'ID', key: 'id' },
  { title: '举报人邮箱', key: 'reporterEmail' },
  { title: '资源链接', key: 'resourceUrl', ellipsis: { tooltip: true } },
  { title: '理由', key: 'reason', ellipsis: { tooltip: true } },
  { title: '状态', key: 'status' },
  { title: '时间', key: 'createdAt', render: (row: { createdAt: string }) => new Date(row.createdAt).toLocaleString() },
  {
    title: '操作',
    key: 'actions',
    render: (row: { id: bigint; status: string }) =>
      row.status === 'pending'
        ? h('div', { class: 'flex gap-2' }, [
            h(NButton, { size: 'small', type: 'error', onClick: () => resolve(row.id, 'resolved') }, () => '下架'),
            h(NButton, { size: 'small', onClick: () => resolve(row.id, 'rejected') }, () => '驳回'),
          ])
        : null,
  },
]

async function load() {
  loading.value = true
  try {
    const data = await api.get<{ list: unknown[]; total: number }>('/takedown', {
      page: pagination.page,
      pageSize: pagination.pageSize,
    })
    records.value = data.list
    pagination.itemCount = data.total
  } finally {
    loading.value = false
  }
}

async function resolve(id: bigint, status: 'resolved' | 'rejected') {
  try {
    await api.patch(`/takedown/${id}/resolve`, { status })
    message.success(status === 'resolved' ? '已下架' : '已驳回')
    load()
  } catch (err) {
    message.error((err as Error).message)
  }
}

onMounted(load)
</script>
