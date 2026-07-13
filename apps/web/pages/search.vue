<template>
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <h1 class="text-3xl font-bold mb-6">搜索结果</h1>

    <!-- 搜索栏 -->
    <div class="mb-4">
      <n-input-group>
        <n-input
          v-model:value="keyword"
          size="large"
          placeholder="输入关键词..."
          @keyup.enter="doSearch"
          clearable
        />
        <n-button size="large" type="primary" @click="doSearch" :loading="loading">
          搜索
        </n-button>
      </n-input-group>
    </div>

    <!-- 搜索模式切换 -->
    <div class="mb-6 flex items-center gap-2 flex-wrap">
      <n-radio-group v-model:value="searchMode" size="small" @update:value="doSearch">
        <n-radio-button value="live">实时搜索</n-radio-button>
        <n-radio-button value="fuzzy">模糊搜索</n-radio-button>
        <n-radio-button value="combined">组合搜索</n-radio-button>
      </n-radio-group>
      <span class="text-xs text-gray-400">
        <template v-if="searchMode === 'live'">多源并发聚合，结果最新</template>
        <template v-else-if="searchMode === 'fuzzy'">本地索引，支持拼音/分词/容错，速度极快</template>
        <template v-else>实时 + 索引合并去重，召回率最高</template>
      </span>
    </div>

    <!-- 结果信息 -->
    <div v-if="result" class="text-sm text-gray-500 mb-4 flex-between">
      <div>
        共找到 <span class="font-semibold text-gray-700 dark:text-gray-300">{{ result.total }}</span> 条结果
        <span class="ml-2">耗时 {{ result.durationMs }}ms</span>
        <n-tag v-if="result.fromIndex" size="tiny" type="info" class="ml-2">来自索引</n-tag>
        <span v-if="result.errors && result.errors.length > 0" class="text-yellow-600 ml-2">
          （{{ result.errors.length }} 个源失败）
        </span>
      </div>
      <n-tag size="small" :type="providersTagType">
        {{ result.providers.join(' + ') }}
      </n-tag>
    </div>

    <!-- 结果列表 -->
    <div v-if="loading" class="space-y-3">
      <n-card v-for="i in 5" :key="i">
        <n-skeleton text :repeat="3" />
      </n-card>
    </div>

    <div v-else-if="result && result.list.length > 0" class="space-y-3">
      <n-card
        v-for="(item, idx) in result.list"
        :key="item.url + idx"
        hoverable
        class="overflow-hidden"
      >
        <!-- 标题行 -->
        <div class="flex items-start gap-3 mb-2">
          <div class="flex-1 min-w-0">
            <div class="font-medium text-base truncate" :title="item.title">
              {{ item.title }}
            </div>
          </div>
          <n-tag size="small" :type="categoryColor(item.category)" class="shrink-0">
            {{ item.sourceDisplayName }}
          </n-tag>
        </div>

        <!-- 元数据行 -->
        <div class="flex items-center gap-3 flex-wrap text-xs text-gray-500 dark:text-gray-400 mb-3">
          <span v-if="item.fileType" class="flex items-center gap-1">
            <n-icon><cloud-icon /></n-icon>
            {{ item.fileType }}
          </span>
          <span v-if="item.fileSize" class="flex items-center gap-1">
            {{ formatSize(item.fileSize) }}
          </span>
          <span v-if="extractPassword(item)" class="flex items-center gap-1">
            <n-icon><key-icon /></n-icon>
            提取码：
            <code class="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded font-mono">
              {{ extractPassword(item) }}
            </code>
            <n-button size="tiny" quaternary @click="copyPassword(item)">复制</n-button>
          </span>
        </div>

        <!-- URL 行 -->
        <div class="truncate text-xs text-gray-400 mb-3 font-mono">{{ item.url }}</div>

        <!-- 操作行 -->
        <div class="flex gap-2 flex-wrap">
          <n-button size="small" tag="a" :href="item.url" target="_blank" type="primary">
            打开链接
          </n-button>
          <n-button size="small" @click="copyLink(item.url)">复制链接</n-button>
          <n-button size="small" @click="addToFavorite(item)">收藏</n-button>
          <n-button size="small" @click="reportDead(item.url)" quaternary type="warning">
            举报失效
          </n-button>
        </div>
      </n-card>

      <!-- 分页 -->
      <div class="flex-center pt-4" v-if="result.totalPages > 1">
        <n-pagination
          v-model:page="page"
          :page-count="result.totalPages"
          @update:page="onPageChange"
        />
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else-if="result && result.list.length === 0" class="text-center py-16">
      <n-empty :description="emptyDescription">
        <template #extra>
          <n-space vertical align="center">
            <n-button v-if="searchMode !== 'fuzzy'" type="primary" @click="switchToFuzzy">
              试试模糊搜索
            </n-button>
            <n-button quaternary @click="switchToCombined">
              尝试组合搜索
            </n-button>
          </n-space>
        </template>
      </n-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  NInput, NInputGroup, NButton, NCard, NTag, NPagination, NSkeleton, NEmpty,
  NRadioButton, NRadioGroup, NIcon, NSpace,
  useMessage,
} from 'naive-ui'
import { ref, computed, watch, onMounted, h } from 'vue'

interface SearchResultItem {
  title: string
  url: string
  source: string
  sourceDisplayName: string
  category: string
  fileSize?: number
  fileType?: string
  resourceMeta?: {
    cloudType?: string
    password?: string | null
    datetime?: string | null
    magnetHash?: string | null
  }
}

interface SearchResponse {
  list: SearchResultItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  durationMs: number
  providers: string[]
  errors: string[]
  fromIndex?: boolean
}

// 简单图标组件（避免引入图标库）
const CloudIcon = () => h('span', '☁')
const KeyIcon = () => h('span', '🔑')
const cloudIcon = CloudIcon
const keyIcon = KeyIcon

const route = useRoute()
const router = useRouter()
const { api } = useApi()
const message = useMessage()

const keyword = ref((route.query.q as string) || '')
const page = ref(1)
const pageSize = ref(20)
const loading = ref(false)
const result = ref<SearchResponse | null>(null)
const searchMode = ref<'live' | 'fuzzy' | 'combined'>((route.query.mode as 'live' | 'fuzzy' | 'combined') || 'live')

const providersTagType = computed<'default' | 'success' | 'info' | 'warning'>(() => {
  if (!result.value) return 'default'
  if (result.value.fromIndex) return 'info'
  if (result.value.providers.length > 1) return 'success'
  return 'default'
})

const emptyDescription = computed(() => {
  if (searchMode.value === 'live') return '实时搜索无结果，可尝试模糊搜索（从历史索引匹配）'
  if (searchMode.value === 'fuzzy') return '索引中无匹配结果，可尝试实时搜索或组合搜索'
  return '暂无搜索结果，换个关键词试试'
})

async function doSearch() {
  if (!keyword.value.trim()) return
  loading.value = true

  // 更新 URL（保留查询历史）
  router.replace({
    path: '/search',
    query: { q: keyword.value, mode: searchMode.value, page: String(page.value) },
  })

  try {
    const endpoint = searchMode.value === 'fuzzy'
      ? '/search/fuzzy'
      : searchMode.value === 'combined'
        ? '/search/combined'
        : '/search'

    result.value = await api.get<SearchResponse>(endpoint, {
      keyword: keyword.value,
      page: page.value,
      pageSize: pageSize.value,
    })
  } catch (err) {
    message.error((err as Error).message || '搜索失败')
    result.value = null
  } finally {
    loading.value = false
  }
}

function onPageChange(p: number) {
  page.value = p
  doSearch()
}

function switchToFuzzy() {
  searchMode.value = 'fuzzy'
  page.value = 1
  doSearch()
}

function switchToCombined() {
  searchMode.value = 'combined'
  page.value = 1
  doSearch()
}

watch(() => route.query, () => {
  const q = route.query.q as string
  const mode = route.query.mode as 'live' | 'fuzzy' | 'combined'
  if (q && q !== keyword.value) {
    keyword.value = q
  }
  if (mode && mode !== searchMode.value) {
    searchMode.value = mode
  }
  page.value = 1
  doSearch()
})

onMounted(() => {
  if (keyword.value) {
    doSearch()
  }
})

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function categoryColor(category: string): 'default' | 'success' | 'info' | 'warning' | 'error' {
  const map: Record<string, 'default' | 'success' | 'info' | 'warning' | 'error'> = {
    netdisk: 'success',
    magnet: 'info',
    tg: 'warning',
    forum: 'default',
  }
  return map[category] || 'default'
}

function extractPassword(item: SearchResultItem): string | null {
  return item.resourceMeta?.password || null
}

async function copyPassword(item: SearchResultItem) {
  const pwd = extractPassword(item)
  if (!pwd) return
  try {
    await navigator.clipboard.writeText(pwd)
    message.success('提取码已复制')
  } catch {
    message.error('复制失败，请手动复制')
  }
}

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url)
    message.success('链接已复制')
  } catch {
    message.error('复制失败，请手动复制')
  }
}

async function addToFavorite(item: SearchResultItem) {
  try {
    await api.post('/favorites', {
      resourceUrl: item.url,
      title: item.title,
      source: item.source,
      category: item.category,
    })
    message.success('已收藏')
  } catch (err) {
    message.error((err as Error).message || '收藏失败')
  }
}

async function reportDead(url: string) {
  try {
    await api.post('/link-checker/report-dead', { url })
    message.success('已收到举报，将在下次检测时处理')
  } catch (err) {
    message.error((err as Error).message || '举报失败')
  }
}
</script>
