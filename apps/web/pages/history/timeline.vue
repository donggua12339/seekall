<template>
  <div class="container mx-auto px-4 py-8 max-w-3xl">
    <div class="flex-between mb-6">
      <h1 class="text-2xl font-bold">搜索历史时间线</h1>
      <n-button size="small" quaternary type="error" @click="clearAll" :loading="clearing">
        清空历史
      </n-button>
    </div>

    <n-empty v-if="!loading && groups.length === 0" description="暂无搜索历史" class="py-16" />

    <!-- 时间线 -->
    <div v-else class="timeline">
      <div v-for="group in groups" :key="group.date" class="timeline-group">
        <!-- 日期标题 -->
        <div class="timeline-date">
          <span class="date-badge">{{ group.dateLabel }}</span>
          <span class="date-count">{{ group.items.length }} 次搜索</span>
        </div>

        <!-- 该日期下的搜索记录 -->
        <div class="timeline-items">
          <div
            v-for="item in group.items"
            :key="item.id"
            class="timeline-item"
            @click="goToSearch(item.query)"
          >
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-time">{{ formatTime(item.createdAt) }}</div>
              <div class="timeline-query">{{ item.query }}</div>
              <div v-if="item.resultCount !== undefined" class="timeline-meta">
                {{ item.resultCount }} 条结果
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 加载更多 -->
    <div v-if="hasMore" class="text-center mt-6">
      <n-button @click="loadMore" :loading="loadingMore">加载更多</n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, NEmpty, useMessage } from 'naive-ui'
import { ref, computed, onMounted } from 'vue'

interface HistoryItem {
  id: number
  query: string
  resultCount?: number
  createdAt: string
}

interface HistoryGroup {
  date: string
  dateLabel: string
  items: HistoryItem[]
}

definePageMeta({ ssr: false })
useHead({ title: '搜索历史时间线' })

const { api } = useApi()
const message = useMessage()
const router = useRouter()

const loading = ref(false)
const loadingMore = ref(false)
const clearing = ref(false)
const items = ref<HistoryItem[]>([])
const page = ref(1)
const total = ref(0)
const hasMore = computed(() => items.value.length < total.value)

// 按日期分组
const groups = computed<HistoryGroup[]>(() => {
  const map = new Map<string, HistoryItem[]>()
  for (const item of items.value) {
    const date = item.createdAt.slice(0, 10)
    if (!map.has(date)) map.set(date, [])
    map.get(date)!.push(item)
  }
  return Array.from(map.entries()).map(([date, items]) => ({
    date,
    dateLabel: formatDateLabel(date),
    items: items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }))
})

function formatDateLabel(date: string): string {
  const d = new Date(date)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return '今天'
  if (d.toDateString() === yesterday.toDateString()) return '昨天'
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

function goToSearch(query: string) {
  router.push({ path: '/search', query: { q: query } })
}

async function loadHistory() {
  loading.value = true
  try {
    const data = await api.get<{ list: HistoryItem[]; total: number }>('/search-history', {
      page: page.value,
      pageSize: 50,
    })
    items.value = data.list.map((item) => ({
      ...item,
      createdAt: item.createdAt,
    }))
    total.value = data.total
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  loadingMore.value = true
  page.value++
  try {
    const data = await api.get<{ list: HistoryItem[]; total: number }>('/search-history', {
      page: page.value,
      pageSize: 50,
    })
    items.value.push(...data.list)
  } catch {
    page.value--
  } finally {
    loadingMore.value = false
  }
}

async function clearAll() {
  clearing.value = true
  try {
    await api.delete('/search-history')
    items.value = []
    total.value = 0
    message.success('已清空搜索历史')
  } catch (err) {
    message.error('清空失败')
  } finally {
    clearing.value = false
  }
}

onMounted(loadHistory)
</script>

<style scoped>
.timeline {
  position: relative;
}

.timeline-group {
  margin-bottom: 32px;
}

.timeline-date {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.date-badge {
  font-size: 14px;
  font-weight: 600;
  color: #6366f1;
  background: rgba(99, 102, 241, 0.1);
  padding: 4px 12px;
  border-radius: 12px;
}

.date-count {
  font-size: 12px;
  color: #9ca3af;
}

.timeline-items {
  position: relative;
  padding-left: 24px;
  border-left: 2px solid rgba(99, 102, 241, 0.2);
}

.timeline-item {
  position: relative;
  padding: 12px 16px;
  margin-bottom: 12px;
  background: rgba(99, 102, 241, 0.03);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.timeline-item:hover {
  background: rgba(99, 102, 241, 0.08);
  transform: translateX(4px);
}

.timeline-dot {
  position: absolute;
  left: -30px;
  top: 18px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #6366f1;
  border: 2px solid #fff;
  box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
}

.timeline-time {
  font-size: 11px;
  color: #9ca3af;
  margin-bottom: 4px;
}

.timeline-query {
  font-size: 15px;
  font-weight: 500;
  color: #1f2937;
}

:deep(.dark) .timeline-query {
  color: #f3f4f6;
}

.timeline-meta {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}
</style>
