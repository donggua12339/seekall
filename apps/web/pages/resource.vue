<template>
  <div class="container mx-auto px-4 py-8 max-w-3xl">
    <n-card v-if="resource" class="mb-4">
      <!-- 标题 -->
      <h1 class="text-2xl font-bold mb-3 break-all">{{ resource.title }}</h1>

      <!-- 来源标签 -->
      <div class="flex items-center gap-2 mb-4 flex-wrap">
        <n-tag :type="categoryColor(resource.category)" size="small">
          {{ resource.sourceDisplayName }}
        </n-tag>
        <n-tag v-if="resource.fileType" size="small" type="info">
          {{ resource.fileType }}
        </n-tag>
        <n-tag v-if="resource.fileSize" size="small">
          {{ formatSize(resource.fileSize) }}
        </n-tag>
      </div>

      <!-- 提取码 -->
      <div v-if="password" class="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded flex items-center gap-3">
        <span class="text-sm text-yellow-700 dark:text-yellow-300">提取码：</span>
        <code class="text-lg font-mono font-bold">{{ password }}</code>
        <n-button size="small" @click="copyPassword">复制</n-button>
      </div>

      <!-- 资源链接 -->
      <div class="mb-4">
        <div class="text-sm text-gray-500 mb-1">资源链接</div>
        <div class="p-3 bg-gray-50 dark:bg-gray-800 rounded break-all font-mono text-sm">
          {{ resource.url }}
        </div>
      </div>

      <!-- 元数据 -->
      <div v-if="resource.resourceMeta" class="mb-4 grid grid-cols-2 gap-3 text-sm">
        <div v-if="resource.resourceMeta.datetime">
          <span class="text-gray-500">更新时间：</span>
          {{ new Date(resource.resourceMeta.datetime).toLocaleString() }}
        </div>
        <div v-if="resource.resourceMeta.originSource">
          <span class="text-gray-500">来源：</span>
          {{ resource.resourceMeta.originSource }}
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex gap-2 flex-wrap">
        <n-button type="primary" tag="a" :href="resource.url" target="_blank">
          打开链接
        </n-button>
        <n-button @click="copyLink">复制链接</n-button>
        <n-button @click="addToFavorite">收藏</n-button>
        <n-button @click="showShareCard = true">生成分享卡片</n-button>
        <n-button quaternary type="warning" @click="reportDead">举报失效</n-button>
      </div>
    </n-card>

    <n-empty v-else description="资源信息缺失" class="py-16">
      <template #extra>
        <n-button @click="$router.push('/')">返回首页</n-button>
      </template>
    </n-empty>

    <!-- 分享卡片弹窗 -->
    <n-modal v-model:show="showShareCard" preset="card" title="分享卡片" style="width: 420px">
      <ShareCard v-if="resource" :resource="resource" :password="password" />
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import { NCard, NTag, NButton, NEmpty, NModal, useMessage } from 'naive-ui'
import { computed, ref } from 'vue'
import ShareCard from '~/components/ShareCard.vue'

interface ResourceMeta {
  cloudType?: string
  password?: string | null
  datetime?: string | null
  originSource?: string | null
}

interface Resource {
  title: string
  url: string
  source: string
  sourceDisplayName: string
  category: string
  fileSize?: number
  fileType?: string
  resourceMeta?: ResourceMeta
}

definePageMeta({ ssr: false })
useHead({ title: '资源详情' })

const route = useRoute()
const router = useRouter()
const { api } = useApi()
const message = useMessage()

const showShareCard = ref(false)

// 从 URL query 解析资源信息（base64 编码）
const resource = computed<Resource | null>(() => {
  try {
    const data = route.query.data as string
    if (!data) return null
    return JSON.parse(atob(decodeURIComponent(data))) as Resource
  } catch {
    return null
  }
})

const password = computed(() => resource.value?.resourceMeta?.password || null)

function categoryColor(category: string): 'default' | 'success' | 'info' | 'warning' | 'error' {
  const map: Record<string, 'default' | 'success' | 'info' | 'warning' | 'error'> = {
    netdisk: 'success',
    magnet: 'info',
    tg: 'warning',
    forum: 'default',
  }
  return map[category] || 'default'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

async function copyPassword() {
  if (!password.value) return
  try {
    await navigator.clipboard.writeText(password.value)
    message.success('提取码已复制')
  } catch {
    message.error('复制失败')
  }
}

async function copyLink() {
  if (!resource.value) return
  try {
    await navigator.clipboard.writeText(resource.value.url)
    message.success('链接已复制')
  } catch {
    message.error('复制失败')
  }
}

async function addToFavorite() {
  if (!resource.value) return
  try {
    await api.post('/favorites', {
      resourceUrl: resource.value.url,
      title: resource.value.title,
      source: resource.value.source,
      category: resource.value.category,
    })
    message.success('已收藏')
  } catch (err) {
    message.error((err as Error).message || '收藏失败')
  }
}

async function reportDead() {
  if (!resource.value) return
  try {
    await api.post('/link-checker/report-dead', { url: resource.value.url })
    message.success('已收到举报')
  } catch (err) {
    message.error((err as Error).message || '举报失败')
  }
}
</script>
