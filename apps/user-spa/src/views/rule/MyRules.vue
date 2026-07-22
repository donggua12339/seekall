<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  NCard,
  NButton,
  NSpace,
  NDataTable,
  NTag,
  NInput,
  NSelect,
  NEmpty,
  useMessage,
  type DataTableColumns,
} from 'naive-ui'
import { ruleApi, type Rule } from '@/api/rule'
import { getBulkWeeklyDownloads } from '@/api/npm'

const router = useRouter()
const message = useMessage()
const loading = ref(true)
const rules = ref<Rule[]>([])
const search = ref('')
const statusFilter = ref<string | null>(null)
const downloads = ref<Record<string, number>>({})

const statusOptions = [
  { label: '全部', value: '' },
  { label: '待评审', value: 'pending_review' },
  { label: '已发布', value: 'published' },
  { label: '已下架', value: 'taken_down' },
  { label: '已封禁', value: 'banned' },
]

const totalDownloads = computed(() =>
  Object.values(downloads.value).reduce((a, b) => a + b, 0),
)

const filteredRules = computed(() =>
  rules.value.filter((r) => {
    if (search.value && !r.npmPackage.includes(search.value) && !r.description.includes(search.value)) {
      return false
    }
    if (statusFilter.value && r.status !== statusFilter.value) {
      return false
    }
    return true
  }),
)

async function loadRules() {
  loading.value = true
  try {
    const list = await ruleApi.mySubmitted()
    rules.value = list
    // 拉取已发布规则的 npm 下载量（pending/takedown 的规则 npm 上可能不存在，跳过）
    const publishedPackages = list
      .filter((r) => r.status === 'published' && r.npmPackage)
      .map((r) => r.npmPackage)
    if (publishedPackages.length > 0) {
      getBulkWeeklyDownloads(publishedPackages)
        .then((stats) => {
          downloads.value = stats
        })
        .catch(() => {
          // npm API 失败静默（不影响列表展示）
        })
    }
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

const statusLabel = (status: string): string => {
  const map: Record<string, string> = {
    pending_review: '待评审',
    published: '已发布',
    taken_down: '已下架',
    banned: '已封禁',
  }
  return map[status] || status
}

const riskLabel = (level: number) => `L${level}`

const columns: DataTableColumns<Rule> = [
  {
    title: 'npm 包名',
    key: 'npmPackage',
    render: (row) => h('code', { style: 'font-family: monospace;' }, row.npmPackage),
  },
  {
    title: '风险',
    key: 'riskLevel',
    width: 70,
    render: (row) => h(NTag, { size: 'small', bordered: false }, () => riskLabel(row.riskLevel)),
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
    render: (row) =>
      h(NTag, { size: 'small', type: statusTagType(row.status) }, () => statusLabel(row.status)),
  },
  {
    title: '周下载',
    key: 'downloads',
    width: 90,
    render: (row) => {
      const n = downloads.value[row.npmPackage]
      return n !== undefined ? h('span', { style: 'color: #3aa675; font-weight: 600;' }, `⬇ ${n}`) : '—'
    },
  },
  {
    title: '提交时间',
    key: 'createdAt',
    width: 160,
    render: (row) => new Date(row.createdAt).toLocaleString('zh-CN'),
  },
]
</script>

<template>
  <NCard title="我的规则">
    <template #header-extra>
      <NButton type="primary" @click="router.push('/rules/submit')">
        提交新规则
      </NButton>
    </template>

    <NSpace style="margin-bottom: 16px;" align="center">
      <NInput
        v-model:value="search"
        placeholder="搜索 npm 包名或描述"
        clearable
        style="width: 300px;"
      />
      <NSelect
        v-model:value="statusFilter"
        :options="statusOptions"
        placeholder="状态筛选"
        clearable
        style="width: 160px;"
      />
      <NTag v-if="rules.length > 0" size="small" type="info" round>
        共 {{ rules.length }} 个规则 · 周下载 {{ totalDownloads }}
      </NTag>
    </NSpace>

    <NDataTable
      :columns="columns"
      :data="filteredRules"
      :loading="loading"
      :bordered="false"
      striped
    >
      <template #empty>
        <NEmpty description="还没提交过规则">
          <template #extra>
            <NButton type="primary" @click="router.push('/rules/submit')">
              提交第一个规则
            </NButton>
          </template>
        </NEmpty>
      </template>
    </NDataTable>
  </NCard>
</template>
