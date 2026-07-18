<script setup lang="ts">
import { ref, reactive, onMounted, h } from 'vue'
import { useRouter } from 'vue-router'
import {
  NCard, NDataTable, NButton, NSpace, NTag, NSelect, NPagination, NSpin, NEmpty,
  type DataTableColumns,
} from 'naive-ui'
import { dmcaApi, type DmcaNotice } from '@/api/dmca'

const router = useRouter()
const loading = ref(false)
const list = ref<DmcaNotice[]>([])
const total = ref(0)
const query = reactive({
  page: 1,
  pageSize: 20,
  status: '' as string,
})

const statusOptions = [
  { label: '全部', value: '' },
  { label: '待处理', value: 'pending' },
  { label: '已验证', value: 'verified' },
  { label: '已下架', value: 'actioned' },
  { label: '已拒绝', value: 'rejected' },
]

function statusTagType(status: DmcaNotice['status']) {
  return {
    pending: 'warning',
    verified: 'info',
    actioned: 'error',
    rejected: 'default',
  }[status] as 'warning' | 'info' | 'error' | 'default'
}

function statusLabel(status: DmcaNotice['status']) {
  return {
    pending: '待处理',
    verified: '已验证',
    actioned: '已下架',
    rejected: '已拒绝',
  }[status]
}

const columns: DataTableColumns<DmcaNotice> = [
  { title: 'ID', key: 'id', width: 80 },
  { title: '原作品', key: 'originalTitle', ellipsis: { tooltip: true }, width: 200 },
  { title: '版权方', key: 'copyrightOwner', ellipsis: { tooltip: true }, width: 160 },
  { title: '侵权 URL', key: 'infringingUrl', ellipsis: { tooltip: true }, width: 240 },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render: (row) =>
      h(NTag, { type: statusTagType(row.status), size: 'small', round: true }, () =>
        statusLabel(row.status),
      ),
  },
  { title: '举报人', key: 'reporterEmail', ellipsis: { tooltip: true }, width: 180 },
  {
    title: '提交时间',
    key: 'createdAt',
    width: 160,
    render: (row) => new Date(row.createdAt).toLocaleString('zh-CN'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render: (row) =>
      h(
        NButton,
        { size: 'small', type: 'primary', text: true, onClick: () => handleDetail(row) },
        () => '查看详情',
      ),
  },
]

async function loadList() {
  loading.value = true
  try {
    const res = await dmcaApi.list({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status || undefined,
    })
    list.value = res.list
    total.value = res.total
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

function handleDetail(row: DmcaNotice) {
  router.push({ name: 'dmca-detail', params: { id: row.id } })
}

function handleStatusChange(val: string) {
  query.status = val
  query.page = 1
  loadList()
}

function handlePageChange(p: number) {
  query.page = p
  loadList()
}

onMounted(loadList)
</script>

<template>
  <NCard title="DMCA 版权举报管理">
    <template #header-extra>
      <NSpace>
        <NSelect
          v-model:value="query.status"
          :options="statusOptions"
          style="width: 140px;"
          @update:value="handleStatusChange"
        />
        <NButton @click="loadList">刷新</NButton>
      </NSpace>
    </template>

    <NSpin :show="loading">
      <NDataTable
        :columns="columns"
        :data="list"
        :bordered="false"
        :single-line="false"
        :row-key="(row: DmcaNotice) => row.id"
      />
      <NEmpty v-if="!loading && list.length === 0" description="暂无举报记录" />

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
