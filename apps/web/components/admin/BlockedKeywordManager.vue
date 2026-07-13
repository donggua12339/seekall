<template>
  <div>
    <div class="flex gap-2 mb-4">
      <n-input v-model:value="newKeyword" placeholder="关键词" />
      <n-input v-model:value="newCategory" placeholder="分类（可选）" style="width: 200px" />
      <n-button type="primary" @click="addKeyword">添加</n-button>
    </div>

    <n-data-table :columns="columns" :data="keywords" :loading="loading" />
  </div>
</template>

<script setup lang="ts">
import { NInput, NButton, NDataTable, useMessage } from 'naive-ui'
import { ref, onMounted, h } from 'vue'

const { api } = useApi()
const message = useMessage()

const newKeyword = ref('')
const newCategory = ref('')
const loading = ref(false)
const keywords = ref<unknown[]>([])

const columns = [
  { title: 'ID', key: 'id' },
  { title: '关键词', key: 'keyword' },
  { title: '分类', key: 'category' },
  { title: '创建者', key: 'createdBy.username' },
  {
    title: '操作',
    key: 'actions',
    render: (row: { id: bigint }) =>
      h(NButton, { size: 'small', type: 'error', quaternary: true, onClick: () => removeKeyword(row.id) }, () => '删除'),
  },
]

async function load() {
  loading.value = true
  try {
    const data = await api.get<{ list: unknown[] }>('/admin/blocked-keywords', { page: 1, pageSize: 100 })
    keywords.value = data.list
  } finally {
    loading.value = false
  }
}

async function addKeyword() {
  if (!newKeyword.value.trim()) return
  try {
    await api.post('/admin/blocked-keywords', {
      keyword: newKeyword.value,
      category: newCategory.value || undefined,
    })
    message.success('已添加')
    newKeyword.value = ''
    newCategory.value = ''
    load()
  } catch (err) {
    message.error((err as Error).message)
  }
}

async function removeKeyword(id: bigint) {
  try {
    await api.delete(`/admin/blocked-keywords/${id}`)
    message.success('已删除')
    load()
  } catch (err) {
    message.error((err as Error).message)
  }
}

onMounted(load)
</script>
