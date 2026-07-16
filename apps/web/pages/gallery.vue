<template>
  <div class="container mx-auto px-4 py-8">
    <div class="flex-between mb-6">
      <h1 class="text-2xl font-bold">资源图墙</h1>
      <div class="flex items-center gap-2">
        <n-input-group>
          <n-input
            v-model:value="keyword"
            placeholder="搜索资源..."
            clearable
            size="small"
            @keyup.enter="doSearch"
          />
          <n-button size="small" type="primary" :loading="loading" @click="doSearch">搜索</n-button>
        </n-input-group>
      </div>
    </div>

    <!-- 图墙 -->
    <div v-if="loading" class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      <div v-for="i in 12" :key="i" class="gallery-skeleton">
        <n-skeleton height="240" width="100%" />
      </div>
    </div>

    <div v-else-if="items.length > 0" class="gallery-grid">
      <div v-for="item in items" :key="item.url" class="gallery-card" @click="goToDetail(item)">
        <!-- 封面图 -->
        <div class="gallery-cover">
          <img
            v-if="getImage(item)"
            :src="getImage(item)"
            :alt="item.title"
            loading="lazy"
            @error="onImgError($event, item)"
          />
          <div v-else class="gallery-placeholder">
            <span class="placeholder-icon">{{ getCategoryIcon(item) }}</span>
            <span class="placeholder-text">{{ item.fileType || item.category }}</span>
          </div>
        </div>

        <!-- 标题 -->
        <div class="gallery-info">
          <div class="gallery-title" :title="item.title">{{ item.title }}</div>
          <div class="gallery-meta">
            <span class="gallery-source">{{ item.sourceDisplayName }}</span>
            <span v-if="item.fileType" class="gallery-type">{{ item.fileType }}</span>
          </div>
        </div>
      </div>
    </div>

    <n-empty v-else description="输入关键词搜索，以图墙形式浏览资源" class="py-16">
      <template #extra>
        <p class="text-sm text-gray-400">图墙模式适合浏览影视、动漫等有封面的资源</p>
      </template>
    </n-empty>
  </div>
</template>

<script setup lang="ts">
import { NInput, NInputGroup, NButton, NSkeleton, NEmpty, useMessage } from 'naive-ui'
import { ref, onMounted } from 'vue'

interface SearchResultItem {
  title: string
  url: string
  source: string
  sourceDisplayName: string
  category: string
  fileSize?: number
  fileType?: string
  tags?: string[]
  resourceMeta?: {
    cloudType?: string
    password?: string | null
    datetime?: string | null
    images?: string[]
    originSource?: string | null
  }
}

definePageMeta({ ssr: false })
useHead({ title: '资源图墙' })

const route = useRoute()
const router = useRouter()
const { api } = useApi()
const message = useMessage()

const keyword = ref((route.query.q as string) || '')
const loading = ref(false)
const items = ref<SearchResultItem[]>([])

function getImage(item: SearchResultItem): string | undefined {
  const images = item.resourceMeta?.images
  if (images && images.length > 0) return images[0]
  return undefined
}

function getCategoryIcon(item: SearchResultItem): string {
  const ft = item.fileType || ''
  if (ft.includes('夸克')) return '☁'
  if (ft.includes('阿里')) return '📂'
  if (ft.includes('百度')) return '💾'
  if (ft.includes('磁力')) return '🧲'
  if (ft.includes('迅雷')) return '⚡'
  return '📄'
}

function onImgError(event: Event, _item: SearchResultItem) {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
  const parent = img.parentElement
  if (parent) {
    parent.classList.add('img-error')
  }
}

function goToDetail(item: SearchResultItem) {
  const data = encodeURIComponent(btoa(JSON.stringify(item)))
  router.push({ path: '/resource', query: { data } })
}

async function doSearch() {
  if (!keyword.value.trim()) return
  loading.value = true
  router.replace({ path: '/gallery', query: { q: keyword.value } })

  try {
    const result = await api.get<{ list: SearchResultItem[] }>('/search', {
      keyword: keyword.value,
      page: 1,
      pageSize: 50,
    })
    items.value = result.list
  } catch (err) {
    message.error('搜索失败')
    items.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  if (keyword.value) doSearch()
})
</script>

<style scoped>
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 16px;
}

.gallery-card {
  cursor: pointer;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: all 0.3s;
}

:deep(.dark) .gallery-card {
  background: rgba(30, 30, 40, 0.6);
  border-color: rgba(60, 60, 80, 0.3);
}

.gallery-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(99, 102, 241, 0.15);
}

.gallery-cover {
  width: 100%;
  aspect-ratio: 2 / 3;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  position: relative;
}

.gallery-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.gallery-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.8);
}

.placeholder-icon {
  font-size: 3rem;
  margin-bottom: 8px;
}

.placeholder-text {
  font-size: 0.875rem;
}

.gallery-info {
  padding: 10px 12px;
}

.gallery-title {
  font-size: 13px;
  font-weight: 500;
  line-height: 1.4;
  max-height: 40px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  margin-bottom: 6px;
  color: #1f2937;
}

:deep(.dark) .gallery-title {
  color: #f3f4f6;
}

.gallery-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #6b7280;
}

.gallery-source {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gallery-type {
  background: rgba(99, 102, 241, 0.1);
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
}

.gallery-skeleton {
  border-radius: 12px;
  overflow: hidden;
}
</style>
