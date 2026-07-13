<template>
  <div class="min-h-[calc(100vh-200px)] flex-center flex-col px-4">
    <!-- Logo & 标题 -->
    <div class="text-center mb-12">
      <h1 class="text-5xl md:text-6xl font-bold text-indigo-600 dark:text-indigo-400 mb-3">
        觅源 SeekAll
      </h1>
      <p class="text-gray-600 dark:text-gray-400 text-lg">
        觅寻全网资源，一站即达
      </p>
    </div>

    <!-- 搜索框 -->
    <div class="w-full max-w-2xl">
      <n-input-group>
        <n-input
          v-model:value="keyword"
          size="large"
          placeholder="输入关键词搜索资源..."
          @keyup.enter="handleSearch"
          clearable
        />
        <n-button size="large" type="primary" @click="handleSearch" :loading="loading">
          搜索
        </n-button>
      </n-input-group>

      <!-- 快捷分类 -->
      <div class="flex-center gap-2 mt-6 flex-wrap">
        <n-tag
          v-for="cat in categories"
          :key="cat.value"
          :type="selectedCategory === cat.value ? 'primary' : 'default'"
          class="cursor-pointer"
          @click="selectedCategory = cat.value"
        >
          {{ cat.label }}
        </n-tag>
      </div>
    </div>

    <!-- 免责声明 -->
    <div class="mt-16 text-center text-xs text-gray-400 max-w-xl">
      <p>
        本站仅提供链接聚合服务，不存储任何文件内容。用户使用本站产生的任何后果由用户自行承担。
        如发现侵权内容，请通过
        <NuxtLink to="/takedown" class="text-indigo-500 hover:underline">侵权举报</NuxtLink>
        提交下架请求。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NInput, NInputGroup, NButton, NTag } from 'naive-ui'
import { ref } from 'vue'

// 首页禁用 SSR，避免 Naive UI SSR 渲染卡住
definePageMeta({ ssr: false })

const keyword = ref('')
const selectedCategory = ref<string>('')
const loading = ref(false)

const categories = [
  { label: '全部', value: '' },
  { label: '影视', value: 'movie' },
  { label: '剧集', value: 'tv' },
  { label: '动漫', value: 'anime' },
  { label: '课程', value: 'course' },
  { label: '电子书', value: 'ebook' },
  { label: '软件', value: 'software' },
  { label: '游戏', value: 'game' },
  { label: '音乐', value: 'music' },
  { label: '其他', value: 'other' },
]

const router = useRouter()

function handleSearch() {
  if (!keyword.value.trim()) return
  router.push({
    path: '/search',
    query: { q: keyword.value, category: selectedCategory.value },
  })
}
</script>
