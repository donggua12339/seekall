<template>
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <h1 class="text-3xl font-bold mb-6">搜索结果</h1>

    <!-- 搜索栏 -->
    <div class="mb-4">
      <n-input-group>
        <n-input
          v-model:value="keyword"
          size="large"
          placeholder="输入关键词...（按 / 快速聚焦）"
          class="search-keyword"
          clearable
          @keyup.enter="doSearch"
        />
        <n-button size="large" type="primary" :loading="loading" @click="doSearch"> 搜索 </n-button>
      </n-input-group>
    </div>

    <!-- 搜索模式切换 + 排序 -->
    <div class="mb-6 flex items-center gap-2 flex-wrap">
      <n-radio-group v-model:value="searchMode" size="small" @update:value="doSearch">
        <n-radio-button value="live">实时搜索</n-radio-button>
        <n-radio-button value="fuzzy">模糊搜索</n-radio-button>
        <n-radio-button value="combined">组合搜索</n-radio-button>
      </n-radio-group>

      <!-- 排序 -->
      <n-select
        v-model:value="sortBy"
        size="small"
        :options="sortOptions"
        style="width: 140px"
        @update:value="doSearch"
      />

      <!-- 网盘类型过滤 -->
      <n-select
        v-model:value="fileTypeFilter"
        size="small"
        :options="fileTypeOptions"
        placeholder="全部类型"
        clearable
        style="width: 140px"
        @update:value="doSearch"
      />

      <!-- 资源标签筛选 -->
      <n-select
        v-model:value="tagFilter"
        size="small"
        :options="tagOptions"
        placeholder="全部标签"
        clearable
        style="width: 140px"
        @update:value="applyClientFilters"
      />

      <!-- 订阅此关键词 -->
      <n-button
        v-if="authStore.isLoggedIn && keyword"
        size="small"
        :loading="subscribing"
        @click="toggleSubscribe"
      >
        {{ isSubscribed ? '已订阅' : '+ 订阅' }}
      </n-button>

      <span class="text-xs text-gray-400">
        <template v-if="searchMode === 'live'">多源并发聚合</template>
        <template v-else-if="searchMode === 'fuzzy'">本地索引，极速</template>
        <template v-else>实时 + 索引合并</template>
      </span>

      <!-- 流式开关（仅 live 模式可见） -->
      <n-tooltip v-if="searchMode === 'live'" placement="top">
        <template #trigger>
          <n-switch
            v-model:value="streamMode"
            size="small"
            @update:value="(v) => v && page === 1 && doSearch()"
          />
        </template>
        流式搜索：Provider 完成即推送，先到先显
      </n-tooltip>
    </div>

    <!-- 流式进度指示器 -->
    <div
      v-if="streaming"
      class="mb-4 text-sm bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3"
    >
      <div class="flex items-center gap-2 mb-2">
        <n-spin size="small" />
        <span class="font-medium">流式搜索中…</span>
        <span class="text-gray-500 ml-auto">
          已找到
          <span class="font-semibold text-indigo-600 dark:text-indigo-400">{{
            result?.list.length || 0
          }}</span>
          条 · 已到达 {{ streamArrivedProviders.size }} / {{ streamProviders.length }} 个源
        </span>
      </div>
      <div class="flex flex-wrap gap-1">
        <n-tag
          v-for="p in streamProviders"
          :key="p"
          size="tiny"
          :type="streamArrivedProviders.has(p) ? 'success' : 'default'"
        >
          {{ p }}{{ streamArrivedProviders.has(p) ? ' ✓' : ' …' }}
        </n-tag>
      </div>
      <div
        v-if="streamErrors.length > 0"
        class="mt-2 text-xs text-red-500 flex items-center gap-2 flex-wrap"
      >
        <span>失败：{{ streamErrors.map((e) => e.provider).join('、') }}</span>
        <n-button size="tiny" type="error" ghost @click="doSearch">重试</n-button>
      </div>
    </div>

    <!-- 结果信息 -->
    <div v-if="result" class="text-sm text-gray-500 mb-4 flex-between">
      <div>
        共找到
        <span class="font-semibold text-gray-700 dark:text-gray-300">{{ result.total }}</span>
        条结果
        <span class="ml-2">耗时 {{ result.durationMs }}ms</span>
        <n-tag v-if="result.fromIndex" size="tiny" type="info" class="ml-2">来自索引</n-tag>
        <span v-if="result.errors && result.errors.length > 0" class="text-yellow-600 ml-2">
          （{{ result.errors.length }} 个源失败）
        </span>
      </div>
      <n-tag size="small" :type="providersTagType">
        {{ (result.providers || []).join(' + ') }}
      </n-tag>
    </div>

    <!-- 结果列表 -->
    <div v-if="loading" class="space-y-3">
      <n-card v-for="i in 5" :key="i">
        <n-skeleton text :repeat="3" />
      </n-card>
    </div>

    <div v-else-if="result && filteredList.length > 0" class="space-y-3">
      <n-card
        v-for="(item, idx) in filteredList"
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
            <!-- 资源标签 -->
            <div v-if="item.tags && item.tags.length > 0" class="flex flex-wrap gap-1 mt-1">
              <n-tag
                v-for="tag in item.tags"
                :key="tag"
                size="tiny"
                :type="tagColor(tag)"
                :bordered="false"
              >
                {{ tagLabel(tag) }}
              </n-tag>
            </div>
          </div>
          <n-tag size="small" :type="categoryColor(item.category)" class="shrink-0">
            {{ item.sourceDisplayName }}
          </n-tag>
        </div>

        <!-- 元数据行 -->
        <div
          class="flex items-center gap-3 flex-wrap text-xs text-gray-500 dark:text-gray-400 mb-3"
        >
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
          <n-button size="small" @click="goToDetail(item)">详情</n-button>
          <n-button size="small" @click="copyLink(item.url)">复制链接</n-button>
          <n-button size="small" @click="addToFavorite(item)">收藏</n-button>

          <!-- 有效性投票 -->
          <n-button-group size="small">
            <n-button :loading="votingUrl === item.url" @click="voteLink(item.url, 'up')">
              👍 {{ item.voteUp || 0 }}
            </n-button>
            <n-button :loading="votingUrl === item.url" @click="voteLink(item.url, 'down')">
              👎 {{ item.voteDown || 0 }}
            </n-button>
          </n-button-group>

          <n-button size="small" quaternary type="warning" @click="reportDead(item.url)">
            举报失效
          </n-button>
        </div>
      </n-card>

      <!-- 分页 -->
      <div v-if="!streaming && result.totalPages > 1" class="flex-center pt-4">
        <n-pagination
          v-model:page="page"
          :page-count="result.totalPages"
          @update:page="onPageChange"
        />
      </div>
    </div>

    <!-- 流式期间底部骨架屏（结果未全部到达时显示） -->
    <div v-if="streaming && (result?.list.length || 0) > 0" class="space-y-3 mt-3 opacity-60">
      <n-card v-for="i in 2" :key="`skeleton-${i}`">
        <n-skeleton text :repeat="3" />
      </n-card>
    </div>

    <!-- 空状态 -->
    <div
      v-else-if="result && (result.list.length === 0 || filteredList.length === 0)"
      class="text-center py-16"
    >
      <n-empty :description="emptyDescription">
        <template #extra>
          <n-space vertical align="center" :size="12">
            <!-- 主操作：切换搜索模式 -->
            <n-space justify="center">
              <n-button v-if="searchMode !== 'fuzzy'" type="primary" @click="switchToFuzzy">
                试试模糊搜索
              </n-button>
              <n-button v-if="searchMode !== 'combined'" quaternary @click="switchToCombined">
                尝试组合搜索
              </n-button>
              <n-button v-if="searchMode !== 'live'" quaternary @click="switchToLive">
                尝试实时搜索
              </n-button>
            </n-space>

            <!-- 移除过滤器 -->
            <n-button
              v-if="fileTypeFilter || tagFilter || sortBy !== 'relevance'"
              size="small"
              quaternary
              type="warning"
              @click="clearFilters"
            >
              清除过滤器重试
            </n-button>

            <!-- 订阅关键词 -->
            <n-button
              v-if="authStore.isLoggedIn && keyword"
              size="small"
              quaternary
              :loading="subscribing"
              @click="toggleSubscribe"
            >
              {{ isSubscribed ? '已订阅此关键词' : '+ 订阅此关键词，新结果通知我' }}
            </n-button>

            <!-- 跳转外部搜索 -->
            <div class="text-xs text-gray-400 mt-2">
              没找到？试试外部搜索：
              <n-button
                v-for="ext in externalSearchEngines"
                :key="ext.name"
                size="tiny"
                quaternary
                tag="a"
                :href="ext.url + encodeURIComponent(keyword)"
                target="_blank"
                rel="noopener"
              >
                {{ ext.name }}
              </n-button>
            </div>
          </n-space>
        </template>
      </n-empty>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  NInput,
  NInputGroup,
  NButton,
  NButtonGroup,
  NCard,
  NTag,
  NPagination,
  NSkeleton,
  NEmpty,
  NRadioButton,
  NRadioGroup,
  NIcon,
  NSpace,
  NSelect,
  NSwitch,
  NSpin,
  NTooltip,
  useMessage,
} from 'naive-ui'
import { ref, computed, watch, onMounted, onUnmounted, h } from 'vue'
import { watchDebounced } from '@vueuse/core'

interface SearchResultItem {
  title: string
  url: string
  source: string
  sourceDisplayName: string
  category: string
  fileSize?: number
  fileType?: string
  tags?: string[]
  voteUp?: number
  voteDown?: number
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
// 在 setup 顶部获取 runtimeConfig，事件处理函数里 useRuntimeConfig() 会丢失 Nuxt 上下文
const runtimeConfig = useRuntimeConfig()
const searchMode = ref<'live' | 'fuzzy' | 'combined'>(
  (route.query.mode as 'live' | 'fuzzy' | 'combined') || 'live',
)
const sortBy = ref<string>((route.query.sort as string) || 'relevance')
const fileTypeFilter = ref<string | null>((route.query.fileType as string) || null)
const tagFilter = ref<string | null>(null)

// 流式搜索状态
const streamMode = ref<boolean>(searchMode.value === 'live')
const streaming = ref(false)
const streamProviders = ref<string[]>([])
const streamArrivedProviders = ref<Set<string>>(new Set())
const streamErrors = ref<Array<{ provider: string; error: string }>>([])
let streamEventSource: EventSource | null = null

// 外部搜索引擎（空结果时引导）
const externalSearchEngines = [
  { name: 'Google', url: 'https://www.google.com/search?q=' },
  { name: 'Bing', url: 'https://www.bing.com/search?q=' },
  { name: '百度', url: 'https://www.baidu.com/s?wd=' },
  { name: 'F搜', url: 'https://fsoufsou.com/search?q=' },
]

function clearFilters() {
  fileTypeFilter.value = null
  tagFilter.value = null
  sortBy.value = 'relevance'
  page.value = 1
  doSearch()
}

// 资源标签元数据
const TAG_LABELS: Record<string, string> = {
  movie: '电影',
  tv: '剧集',
  anime: '动漫',
  course: '课程',
  ebook: '电子书',
  software: '软件',
  game: '游戏',
  music: '音乐',
  document: '文档',
  other: '其他',
}

const TAG_COLORS: Record<string, 'default' | 'success' | 'info' | 'warning' | 'error'> = {
  movie: 'error',
  tv: 'warning',
  anime: 'info',
  course: 'success',
  ebook: 'success',
  software: 'default',
  game: 'warning',
  music: 'info',
  document: 'default',
  other: 'default',
}

function tagLabel(tag: string): string {
  return TAG_LABELS[tag] || tag
}

function tagColor(tag: string): 'default' | 'success' | 'info' | 'warning' | 'error' {
  return TAG_COLORS[tag] || 'default'
}

// 标签筛选选项（从搜索结果动态生成）
const tagOptions = computed(() => {
  if (!result.value) return []
  const tags = new Set<string>()
  result.value.list.forEach((item) => {
    item.tags?.forEach((t) => tags.add(t))
  })
  return Array.from(tags).map((t) => ({ label: TAG_LABELS[t] || t, value: t }))
})

// 客户端标签筛选（不重新发起请求，直接过滤当前结果）
const filteredList = computed(() => {
  if (!result.value) return []
  let list = result.value.list
  // 客户端标签过滤
  if (tagFilter.value) {
    list = list.filter((item) => item.tags?.includes(tagFilter.value!))
  }
  // 客户端 fileType 过滤（流式模式下服务端不过滤，前端即时过滤）
  if (fileTypeFilter.value && streaming.value) {
    list = list.filter(
      (r) =>
        r.fileType === fileTypeFilter.value ||
        r.fileType?.includes(fileTypeFilter.value!) ||
        r.category === fileTypeFilter.value,
    )
  }
  // 流式完成后按用户排序重排
  if (!streaming.value && sortBy.value !== 'relevance') {
    const arr = [...list]
    if (sortBy.value === 'time') {
      arr.sort((a, b) => {
        const ta = extractTimeForSort(a) || 0
        const tb = extractTimeForSort(b) || 0
        return tb - ta
      })
    } else if (sortBy.value === 'size') {
      arr.sort((a, b) => (b.fileSize || 0) - (a.fileSize || 0))
    } else if (sortBy.value === 'source') {
      arr.sort((a, b) => a.sourceDisplayName.localeCompare(b.sourceDisplayName))
    }
    return arr
  }
  return list
})

function extractTimeForSort(item: SearchResultItem): number | null {
  const meta = item.resourceMeta as { datetime?: string | null } | undefined
  if (!meta?.datetime) return null
  const t = new Date(meta.datetime).getTime()
  return isNaN(t) ? null : t
}

function applyClientFilters() {
  // 触发 filteredList 重新计算即可
}

// 订阅状态
const authStore = useAuthStore()
const subscribing = ref(false)
const isSubscribed = ref(false)

async function checkSubscriptionStatus() {
  if (!authStore.isLoggedIn || !keyword.value) {
    isSubscribed.value = false
    return
  }
  try {
    const list = await api.get<Array<{ keyword: string }>>('/subscriptions')
    isSubscribed.value = list.some((s) => s.keyword === keyword.value.trim())
  } catch {
    // 静默失败
  }
}

async function toggleSubscribe() {
  if (!authStore.isLoggedIn) {
    message.warning('请先登录')
    return
  }
  if (!keyword.value.trim()) return
  subscribing.value = true
  try {
    if (isSubscribed.value) {
      const list = await api.get<Array<{ id: number; keyword: string }>>('/subscriptions')
      const sub = list.find((s) => s.keyword === keyword.value.trim())
      if (sub) {
        await api.delete(`/subscriptions/${sub.id}`)
        isSubscribed.value = false
        message.success('已取消订阅')
      }
    } else {
      await api.post('/subscriptions', { keyword: keyword.value.trim(), notifyEmail: true })
      isSubscribed.value = true
      message.success('订阅成功，有新资源时将邮件通知')
    }
  } catch (err) {
    message.error((err as Error).message || '操作失败')
  } finally {
    subscribing.value = false
  }
}

// 排序选项
const sortOptions = [
  { label: '相关度', value: 'relevance' },
  { label: '最新', value: 'time' },
  { label: '文件大小', value: 'size' },
  { label: '来源', value: 'source' },
]

// 网盘类型过滤选项（从搜索结果动态生成）
const fileTypeOptions = computed(() => {
  if (!result.value) return []
  const types = new Set<string>()
  result.value.list.forEach((item) => {
    if (item.fileType) types.add(item.fileType)
    if (item.category) types.add(item.category)
  })
  return Array.from(types).map((t) => ({ label: t, value: t }))
})

const providersTagType = computed<'default' | 'success' | 'info' | 'warning'>(() => {
  if (!result.value) return 'default'
  if (result.value.fromIndex) return 'info'
  if ((result.value.providers || []).length > 1) return 'success'
  return 'default'
})

const emptyDescription = computed(() => {
  if (searchMode.value === 'live') return '实时搜索无结果，可尝试模糊搜索或组合搜索'
  if (searchMode.value === 'fuzzy') return '索引中无匹配结果，可尝试实时搜索或组合搜索'
  return '组合搜索也无结果，换个关键词试试'
})

async function doSearch() {
  if (!keyword.value.trim()) return

  // 关闭可能存在的 SSE
  closeStream()

  // 流式模式：仅 live 模式第一页启用
  if (streamMode.value && searchMode.value === 'live' && page.value === 1) {
    return doStreamSearch()
  }

  loading.value = true

  // 更新 URL（保留查询历史）
  router.replace({
    path: '/search',
    query: {
      q: keyword.value,
      mode: searchMode.value,
      sort: sortBy.value,
      fileType: fileTypeFilter.value || undefined,
      page: String(page.value),
    },
  })

  try {
    const endpoint =
      searchMode.value === 'fuzzy'
        ? '/search/fuzzy'
        : searchMode.value === 'combined'
          ? '/search/combined'
          : '/search'

    result.value = await api.get<SearchResponse>(endpoint, {
      keyword: keyword.value,
      page: page.value,
      pageSize: pageSize.value,
      sort: sortBy.value,
      fileType: fileTypeFilter.value || undefined,
    })
  } catch (err) {
    message.error((err as Error).message || '搜索失败')
    result.value = null
  } finally {
    loading.value = false
  }
}

/**
 * 流式搜索 - 通过 SSE 接收每个 Provider 的结果，先到先显
 */
function doStreamSearch(retryCount = 0) {
  streaming.value = true
  // 流式期间不显示全屏骨架屏，改为底部追加骨架屏
  loading.value = false
  streamProviders.value = []
  streamArrivedProviders.value = new Set()
  streamErrors.value = []

  // 初始化空结果集，UI 立即显示"搜索中"状态
  // 关键：必须预置 providers/errors 字段，否则模板 result.providers.join() / result.errors.length 会崩溃
  result.value = {
    list: [],
    total: 0,
    totalPages: 0,
    page: 1,
    pageSize: pageSize.value,
    durationMs: 0,
    providers: [],
    errors: [],
    fromIndex: false,
  }

  // 更新 URL
  router.replace({
    path: '/search',
    query: {
      q: keyword.value,
      mode: searchMode.value,
      sort: sortBy.value,
      fileType: fileTypeFilter.value || undefined,
      page: '1',
    },
  })

  // 构造 SSE URL
  const params = new URLSearchParams({
    keyword: keyword.value,
    page: '1',
    pageSize: String(pageSize.value),
    sort: sortBy.value,
  })
  if (fileTypeFilter.value) params.set('fileType', fileTypeFilter.value)

  // SSE 目标：优先用配置的 sseBase；否则用 window.location.origin（同源，避免 CSP 跨域阻止）
  // 浏览器场景才解析 origin；SSR 阶段 fallback 到 localhost:7301（不会真正发请求）
  const sseBase =
    (runtimeConfig.public.sseBase as string) ||
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:7301')
  const url = `${sseBase}/api/v1/search/stream?${params.toString()}`

  streamEventSource = new EventSource(url)

  streamEventSource.addEventListener('start', (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data)
      streamProviders.value = data.providers || []
      // 同步更新 result.value.providers（模板第 127 行需要这个字段）
      if (result.value) {
        result.value.providers = data.providers || []
      }
    } catch {}
  })

  streamEventSource.addEventListener('partial', (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data)
      streamArrivedProviders.value.add(data.provider)
      if (result.value) {
        result.value.list = [...result.value.list, ...data.results]
        result.value.total = result.value.list.length
        result.value.totalPages = Math.ceil(result.value.list.length / pageSize.value)
      }
    } catch {}
  })

  streamEventSource.addEventListener('provider-error', (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data)
      streamArrivedProviders.value.add(data.provider)
      streamErrors.value.push({ provider: data.provider, error: data.error })
    } catch {}
  })

  streamEventSource.addEventListener('complete', (e) => {
    try {
      const data = JSON.parse((e as MessageEvent).data)
      if (result.value) {
        result.value.durationMs = data.durationMs || 0
      }
    } catch {}
    closeStream()
  })

  streamEventSource.addEventListener('error', () => {
    // SSE 连接异常
    const wasStreaming = streaming.value
    closeStream()
    if (wasStreaming && retryCount < 1) {
      // 自动重连 1 次
      setTimeout(() => doStreamSearch(retryCount + 1), 1000)
    } else if (wasStreaming) {
      // 重连失败，显示重试按钮
      streamErrors.value.push({ provider: 'SSE', error: '连接中断，请重试' })
      message.error('流式搜索连接中断，可点击重试')
    }
  })
}

function closeStream() {
  if (streamEventSource) {
    streamEventSource.close()
    streamEventSource = null
  }
  streaming.value = false
  loading.value = false
}

function onPageChange(p: number) {
  page.value = p
  doSearch()
}

function switchToFuzzy() {
  closeStream()
  searchMode.value = 'fuzzy'
  streamMode.value = false
  page.value = 1
  doSearch()
}

function switchToCombined() {
  closeStream()
  searchMode.value = 'combined'
  streamMode.value = false
  page.value = 1
  doSearch()
}

function switchToLive() {
  closeStream()
  searchMode.value = 'live'
  streamMode.value = true
  page.value = 1
  doSearch()
}

// 记录上次处理过的 q/mode，避免分页时重复搜索
let lastQ = ''
let lastMode = ''
watch(
  () => route.query,
  () => {
    const q = route.query.q as string
    const mode = route.query.mode as 'live' | 'fuzzy' | 'combined'
    const urlPage = Number(route.query.page) || 1
    // 只在 q 或 mode 变化时才重新搜索（分页由 onPageChange 直接处理）
    if (q === lastQ && mode === lastMode) {
      page.value = urlPage
      return
    }
    lastQ = q
    lastMode = mode
    if (q && q !== keyword.value) {
      keyword.value = q
    }
    if (mode && mode !== searchMode.value) {
      searchMode.value = mode
    }
    page.value = urlPage
    doSearch()
  },
)

// 快捷键：/ 聚焦搜索框，1/2/3 切换搜索模式
function handleKeydown(e: KeyboardEvent) {
  const inInput =
    document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA'

  if (e.key === '/' && !inInput) {
    e.preventDefault()
    const input = document.querySelector<HTMLInputElement>('.search-keyword input')
    input?.focus()
    return
  }

  if (inInput) return

  if (e.key === '1') {
    searchMode.value = 'live'
    page.value = 1
    doSearch()
  } else if (e.key === '2') {
    searchMode.value = 'fuzzy'
    page.value = 1
    doSearch()
  } else if (e.key === '3') {
    searchMode.value = 'combined'
    page.value = 1
    doSearch()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  if (keyword.value) {
    doSearch()
    checkSubscriptionStatus()
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  closeStream()
})

// 关键词变化时检查订阅状态
watchDebounced(
  keyword,
  () => {
    checkSubscriptionStatus()
  },
  { debounce: 300 },
)

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

function goToDetail(item: SearchResultItem) {
  // btoa 不支持 Unicode，先 encodeURIComponent 再 base64
  const encoded = btoa(encodeURIComponent(JSON.stringify(item)))
  router.push({ path: '/resource', query: { data: encoded } })
}

async function reportDead(url: string) {
  try {
    await api.post('/link-checker/report-dead', { url })
    message.success('已收到举报，将在下次检测时处理')
  } catch (err) {
    message.error((err as Error).message || '举报失败')
  }
}

const votingUrl = ref<string | null>(null)

async function voteLink(url: string, vote: 'up' | 'down') {
  votingUrl.value = url
  try {
    const res = await api.post<{ up: number; down: number }>('/link-checker/vote', { url, vote })
    message.success(vote === 'up' ? '已标记为有效' : '已标记为失效')
    // 更新本地数据
    if (result.value) {
      const item = result.value.list.find((i) => i.url === url)
      if (item) {
        item.voteUp = res.up
        item.voteDown = res.down
      }
    }
  } catch (err) {
    message.error((err as Error).message || '投票失败')
  } finally {
    votingUrl.value = null
  }
}
</script>
