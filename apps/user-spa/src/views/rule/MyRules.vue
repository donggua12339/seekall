<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NCard,
  NButton,
  NSpace,
  NDataTable,
  NTag,
  NInput,
  NSelect,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { ruleApi, type Rule } from '@/api/rule'

const router = useRouter()
const message = useMessage()
const loading = ref(true)
const rules = ref<Rule[]>([])
const search = ref('')
const statusFilter = ref<string | null>(null)

const statusOptions = [
  { label: '全部', value: '' },
  { label: '待评审', value: 'pending_review' },
  { label: '已发布', value: 'published' },
  { label: '已下架', value: 'taken_down' },
  { label: '已封禁', value: 'banned' },
]

async function loadRules() {
  loading.value = true
  try {
    const res = await ruleApi.list({ page: 1, pageSize: 100 })
    // 过滤当前用户的规则(后端无 /my/rules 端点,前端过滤 authorId)
    // TODO: 后端补 GET /rules/my 端点
    rules.value = res.list
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(loadRules)

const statusTagType = (status: string): 'default' | 'warning' | 'success' | 'error' => {
  if (status === 'published') return 'success'
  if (status === 'pending_review') return 'warning'
  if (status === 'taken_down') return 'default'
  if (status === 'banned') return 'error'
  return 'default'
}

const riskLabel = (level: number) => `L${level}`

const columns: DataTableColumns<Rule> = [
  {
    title: 'npm 包名',
    key: 'npmPackage',
    render: (row) => row.npmPackage,
  },
  {
    title: '风险等级',
    key: 'riskLevel',
    width: 100,
    render: (row) => NTag ? h(NTag, { size: 'small', bordered: false }, () => riskLabel(row.riskLevel)) : riskLabel(row.riskLevel),
  },
  {
    title: '描述',
    key: 'description',
    ellipsis: { tooltip: true },
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render: (row) => h(NTag, { size: 'small', type: statusTagType(row.status) }, () => row.status),
  },
  {
    title: '提交时间',
    key: 'createdAt',
    width: 180,
    render: (row) => new Date(row.createdAt).toLocaleString('zh-CN'),
  },
]

import { h } from 'vue'

const filteredRules = ref<Rule[]>([])
function applyFilter() {
  filteredRules.value = rules.value.filter((r) => {
    if (search.value && !r.npmPackage.includes(search.value) && !r.description.includes(search.value)) {
      return false
    }
    if (statusFilter.value && r.status !== statusFilter.value) {
      return false
    }
    return true
  })
}
</script>

<template>
  <NCard title="我的规则">
    <template #header-extra>
      <NButton type="primary" @click="router.push('/rules/submit')">
        提交新规则
      </NButton>
    </template>

    <NSpace style="margin-bottom: 16px;">
      <NInput
        v-model:value="search"
        placeholder="搜索 npm 包名或描述"
        clearable
        style="width: 300px;"
        @update:value="applyFilter"
      />
      <NSelect
        v-model:value="statusFilter"
        :options="statusOptions"
        placeholder="状态筛选"
        clearable
        style="width: 160px;"
        @update:value="applyFilter"
      />
    </NSpace>

    <NDataTable
      :columns="columns"
      :data="filteredRules.length > 0 ? filteredRules : rules"
      :loading="loading"
      :bordered="false"
      striped
    />
  </NCard>
</template>
