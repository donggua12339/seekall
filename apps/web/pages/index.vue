<template>
  <div class="home-container">
    <!-- 背景装饰 -->
    <div class="bg-decoration">
      <div class="blob blob-1"></div>
      <div class="blob blob-2"></div>
      <div class="blob blob-3"></div>
    </div>

    <!-- 内容区 -->
    <div class="content-wrapper">
      <!-- Logo & 标题 -->
      <div class="text-center mb-10">
        <div class="logo-icon mb-4">
          <span class="text-5xl">🔍</span>
        </div>
        <h1 class="text-5xl md:text-6xl font-bold mb-3 title-gradient">觅源 SeekAll</h1>
        <p class="text-gray-600 dark:text-gray-400 text-lg md:text-xl">觅寻全网资源，一站即达</p>
      </div>

      <!-- 搜索框 -->
      <div class="w-full max-w-2xl mx-auto">
        <div class="search-box">
          <n-input-group>
            <n-input
              v-model:value="keyword"
              size="large"
              placeholder="输入关键词搜索资源..."
              clearable
              class="search-input"
              @keyup.enter="handleSearch"
            >
              <template #prefix>
                <span class="text-gray-400">🔍</span>
              </template>
            </n-input>
            <n-button
              size="large"
              type="primary"
              :loading="loading"
              class="search-btn"
              @click="handleSearch"
            >
              搜索
            </n-button>
          </n-input-group>
        </div>

        <!-- 搜索模式 -->
        <div class="flex-center gap-2 mt-4">
          <n-radio-group v-model:value="searchMode" size="small">
            <n-radio-button value="live">实时搜索</n-radio-button>
            <n-radio-button value="fuzzy">模糊搜索</n-radio-button>
            <n-radio-button value="combined">组合搜索</n-radio-button>
          </n-radio-group>
        </div>

        <!-- 快捷分类 -->
        <div class="flex-center gap-2 mt-6 flex-wrap">
          <n-tag
            v-for="cat in categories"
            :key="cat.value"
            :type="selectedCategory === cat.value ? 'primary' : 'default'"
            class="cursor-pointer category-tag"
            round
            @click="selectedCategory = cat.value"
          >
            {{ cat.label }}
          </n-tag>
        </div>

        <!-- 热门搜索 -->
        <div v-if="hotKeywords.length > 0" class="mt-8 text-center">
          <span class="text-sm text-gray-500 mr-2">热门搜索：</span>
          <n-tag
            v-for="kw in hotKeywords"
            :key="kw"
            size="small"
            class="cursor-pointer mr-2 mb-2"
            round
            @click="
              keyword = kw
              handleSearch()
            "
          >
            {{ kw }}
          </n-tag>
        </div>
      </div>

      <!-- 特性介绍 -->
      <div class="features-grid mt-16">
        <div class="feature-card">
          <div class="feature-icon">🚀</div>
          <div class="feature-title">多源聚合</div>
          <div class="feature-desc">PanSou + TG 频道 + 磁力站，一次搜索覆盖全网</div>
        </div>
        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <div class="feature-title">极速模糊搜索</div>
          <div class="feature-desc">Meilisearch 本地索引，支持拼音/分词/容错</div>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🔒</div>
          <div class="feature-title">私密小圈子</div>
          <div class="feature-desc">邀请码注册，不公开宣传，安全可控</div>
        </div>
      </div>

      <!-- 免责声明 -->
      <div class="mt-16 text-center text-xs text-gray-400 max-w-xl mx-auto">
        <p>
          本站仅提供链接聚合服务，不存储任何文件内容。用户使用本站产生的任何后果由用户自行承担。
          如发现侵权内容，请通过
          <NuxtLink to="/takedown" class="text-indigo-500 hover:underline">侵权举报</NuxtLink>
          提交下架请求。
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NInput, NInputGroup, NButton, NTag, NRadioButton, NRadioGroup } from 'naive-ui'
import { ref, onMounted } from 'vue'

definePageMeta({ ssr: false })

const keyword = ref('')
const selectedCategory = ref<string>('')
const searchMode = ref<'live' | 'fuzzy' | 'combined'>('live')
const loading = ref(false)
const hotKeywords = ref<string[]>([])

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
const { api } = useApi()

function handleSearch() {
  if (!keyword.value.trim()) return
  router.push({
    path: '/search',
    query: { q: keyword.value, category: selectedCategory.value, mode: searchMode.value },
  })
}

onMounted(async () => {
  // 加载热门搜索词
  try {
    const data = await api.get<{ list: Array<{ query: string; count: number }> }>(
      '/search-history/popular',
      { limit: 10 },
    )
    hotKeywords.value = data.list.map((item) => item.query).filter(Boolean)
  } catch {
    // 接口不可用时用默认热门词
    hotKeywords.value = ['三体', '流浪地球', '我的世界', '庆余年']
  }
})
</script>

<style scoped>
.home-container {
  position: relative;
  min-height: calc(100vh - 200px);
  overflow: hidden;
}

.bg-decoration {
  position: absolute;
  inset: 0;
  overflow: hidden;
  z-index: 0;
}

.blob {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.3;
  animation: float 20s infinite ease-in-out;
}

.blob-1 {
  width: 400px;
  height: 400px;
  background: #6366f1;
  top: -100px;
  left: -100px;
}

.blob-2 {
  width: 300px;
  height: 300px;
  background: #8b5cf6;
  top: 50%;
  right: -50px;
  animation-delay: -5s;
}

.blob-3 {
  width: 350px;
  height: 350px;
  background: #ec4899;
  bottom: -100px;
  left: 30%;
  animation-delay: -10s;
}

:deep(.dark) .blob {
  opacity: 0.15;
}

@keyframes float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  33% {
    transform: translate(30px, -30px) scale(1.1);
  }
  66% {
    transform: translate(-20px, 20px) scale(0.95);
  }
}

.content-wrapper {
  position: relative;
  z-index: 1;
  padding: 60px 16px 40px;
}

.logo-icon {
  font-size: 4rem;
  animation: bounce 2s infinite;
}

@keyframes bounce {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}

.title-gradient {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.search-box {
  box-shadow: 0 8px 32px rgba(99, 102, 241, 0.15);
  border-radius: 12px;
  overflow: hidden;
}

:deep(.search-input .n-input__input-el) {
  font-size: 16px;
}

:deep(.search-btn) {
  font-weight: 600;
  padding: 0 32px;
}

.category-tag {
  transition: all 0.2s;
}

.category-tag:hover {
  transform: translateY(-2px);
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  max-width: 900px;
  margin: 0 auto;
}

.feature-card {
  text-align: center;
  padding: 24px 16px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  transition: all 0.3s;
}

:deep(.dark) .feature-card {
  background: rgba(30, 30, 40, 0.6);
  border-color: rgba(60, 60, 80, 0.3);
}

.feature-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 24px rgba(99, 102, 241, 0.15);
}

.feature-icon {
  font-size: 2.5rem;
  margin-bottom: 12px;
}

.feature-title {
  font-weight: 600;
  font-size: 1.1rem;
  margin-bottom: 8px;
  color: #1f2937;
}

:deep(.dark) .feature-title {
  color: #f3f4f6;
}

.feature-desc {
  font-size: 0.875rem;
  color: #6b7280;
  line-height: 1.5;
}

:deep(.dark) .feature-desc {
  color: #9ca3af;
}

@media (max-width: 640px) {
  .content-wrapper {
    padding: 40px 16px;
  }
  .logo-icon {
    font-size: 3rem;
  }
}
</style>
