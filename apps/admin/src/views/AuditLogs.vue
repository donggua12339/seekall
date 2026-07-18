<script setup lang="ts">
import { ref, reactive, onMounted, h } from 'vue'
import {
  NCard, NDataTable, NSpace, NPagination, NSpin, NEmpty, NTag, NCode,
  type DataTableColumns,
} from 'naive-ui'
import { adminApi, type AuditLog } from '@/api/admin'

const loading = ref(false)
const list = ref<AuditLog[]>([])
const total = ref(0)
const query = reactive({
  page: 1,
  pageSize: 50,
})

const columns: DataTableColumns<AuditLog> = [
  { title: 'ID', key: 'id', width: 80 },
  { title: '操作人', key: 'admin.username', width: 120 },
  { title: '动作', key: 'action', width: 160 },
  { title: '目标类型', key: 'targetType', width: 100 },
  { title: '目标 ID', key: 'targetId', width: 100 },
  {
    title: '详情',
    key: 'detail',
    render: (row) =>
      row.detail
        ? h(NCode, {
            code: JSON.stringify(row.detail, null, 2),
            language: 'json',
            style: 'max-height: 80px; overflow: auto;',
          })
        : h('span', { style: 'color: #9ca3af;' }, '-'),
  },
  {
    title: '时间',
    key: 'createdAt',
    width: 180,
    render: (row) => new Date(row.createdAt).toLocaleString('zh-CN'),
  },
]

async function loadList() {
  loading.value = true
  try {
    const res = await adminApi.auditLogs({
      page: query.page,
      pageSize: query.pageSize,
    })
    list.value = res.list
    total.value = res.total
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

function handlePageChange(p: number) {
  query.page = p
  loadList()
}

onMounted(loadList)
</script>

<template>
  <NCard title="管理员审计日志">
    <template #header-extra>
      <NSpace>
        <NButton @click="loadList">刷新</NButton>
      </NSpace>
    </template>

    <NSpin :show="loading">
      <NDataTable
        :columns="columns"
        :data="list"
        :bordered="false"
        :row-key="(row: AuditLog) => row.id"
      />
      <NEmpty v-if="!loading && list.length === 0" description="暂无审计日志" />

      <NSpace justify="end" style="margin-top: 16px;">
        <NPagination
          :page="query.page"
          :page-size="query.pageSize"
          :item-count="total"
          show-quick-jumper
          @update:page="handlePageChange"
        />
      </NSpace>
    </NSpin>
  </NCard>
</template>
