<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { NButton, NHighlight, NSkeleton, NEmpty, NCheckbox } from 'naive-ui'
import { useMessage } from 'naive-ui'
import { searchApi, type SearchResult, type SearchHit, type ResourceItem } from '@/api/search'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { useRouter } from 'vue-router'

const app = useAppStore()
const auth = useAuthStore()
const router = useRouter()
const message = useMessage()

type State = 'idle' | 'loading' | 'done' | 'error'
const state = ref<State>('idle')
const query = ref('')
const result = ref<SearchResult | null>(null)
const errorMsg = ref('')
const activeSource = ref<string>('') // 域名过滤
const activeCategory = ref<string>('all')
const activeFileType = ref<string>('all') // 文件类型过滤（仅网盘结果有效）
const includePan = ref(false) // 网盘搜索开关（puppeteer 慢，默认关）

// 静态兜底列表：后端热搜词为空（冷启动/Redis 异常）时展示
const HOT_FALLBACK = [
  'Photoshop', 'WPS', 'Office 2024', '剪映',
  '考研资料', '四级', '我的世界', '间谍过家家',
  'ATRI', '小说合集', '电子书', 'Python教程',
]
// 实际渲染的热搜词（动态，后端拉取失败/为空则回落静态）
const hotWords = ref<string[]>(HOT_FALLBACK)

// 资源榜单（热门 / 最新入库，MeiliSearch 沉淀，空则不展示）
const hotResources = ref<ResourceItem[]>([])
const latestResources = ref<ResourceItem[]>([])
// 最新入库板是否已加载过（加载后固定显示，切 range 出空也不隐藏整板）
const latestLoaded = ref(false)
// 最新入库时间范围
const latestRange = ref<'all' | 'today' | 'week' | 'month' | 'year'>('all')
const RANGE_OPTIONS: Array<{ key: typeof latestRange.value; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'today', label: '今天' },
  { key: 'week', label: '一周' },
  { key: 'month', label: '一月' },
  { key: 'year', label: '一年' },
]

async function loadLatest() {
  try {
    latestResources.value = (await searchApi.resourcesLatest(8, latestRange.value)) || []
  } catch {
    latestResources.value = []
  } finally {
    latestLoaded.value = true
  }
}

function pickRange(key: typeof latestRange.value) {
  if (latestRange.value === key) return
  latestRange.value = key
  loadLatest()
}

onMounted(async () => {
  try {
    const list = await searchApi.hot()
    if (list && list.length) {
      hotWords.value = list.map((h) => h.word)
    }
  } catch {
    // 静默回落静态列表
  }
  // 榜单独立拉取，失败静默隐藏
  try {
    hotResources.value = (await searchApi.resourcesHot(8)) || []
  } catch {
    hotResources.value = []
  }
  loadLatest()
})

function openResource(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  software: { label: '软件', color: '#0e9f6e' },
  game: { label: '游戏', color: '#d97706' },
  anime: { label: '动漫', color: '#db2777' },
  pan: { label: '网盘', color: '#2563eb' },
  general: { label: '综合', color: '#6b7280' },
}

function catMeta(key: string) {
  return CATEGORY_META[key] || CATEGORY_META.general
}

async function doSearch(raw?: string, presetCategory?: string) {
  const q = (raw ?? query.value).trim()
  if (!q) return
  query.value = q
  state.value = 'loading'
  activeSource.value = ''
  activeCategory.value = presetCategory ?? 'all'
  activeFileType.value = 'all'
  errorMsg.value = ''
  try {
    result.value = await searchApi.search(q, { pansou: includePan.value })
    state.value = 'done'
  } catch (err) {
    errorMsg.value = (err as Error).message || '搜索失败'
    state.value = 'error'
    message.error(errorMsg.value)
  }
}

function pickHot(q: string) {
  query.value = q
  doSearch()
}

// 底部分类卡片：自动填词 + 搜索 + 预设分类
const CATEGORY_DEFAULT_Q: Record<string, string> = {
  software: '绿色版 便携版',
  game: 'Galgame 汉化',
  anime: '番剧',
  pan: '资源',
}
function pickCategory(cat: string) {
  if (cat === 'pan') includePan.value = true
  doSearch(CATEGORY_DEFAULT_Q[cat] || cat, cat)
}

// CSV 导出
function exportCsv(scope: 'all' | 'filtered') {
  if (!result.value) return
  const rows = scope === 'all' ? result.value.results : filteredResults.value
  if (!rows.length) {
    message.warning('没有可导出的结果')
    return
  }
  const header = ['标题', '链接', '来源', '分类', '摘要']
  const escape = (v: string) => `"${(v || '').replace(/"/g, '""')}"`
  const lines = [header.join(',')]
  for (const h of rows) {
    const cat = (h.meta?.category as string) || 'general'
    lines.push([
      escape(h.title),
      escape(h.url),
      escape(h.source || ''),
      escape(catMeta(cat).label),
      escape(h.snippet || ''),
    ].join(','))
  }
  const bom = '\uFEFF'
  const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `seekall-${result.value.query}-${scope}-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
  message.success(`已导出 ${rows.length} 条结果`)
}

// ── 分类聚合（直接从 results 的 meta.category 聚合，精确到每条结果）──
const categories = computed(() => {
  if (!result.value) return []
  const map = new Map<string, number>()
  for (const h of result.value.results) {
    const cat = (h.meta?.category as string) || 'general'
    map.set(cat, (map.get(cat) || 0) + 1)
  }
  return [...map.entries()]
    .map(([key, count]) => ({ key, count, ...catMeta(key) }))
    .sort((a, b) => b.count - a.count)
})

// ── 文件类型聚合（仅网盘结果有 fileType 标记）──
const FILE_TYPE_META: Record<string, { label: string; icon: string }> = {
  file: { label: '文件', icon: '📄' },
  folder: { label: '文件夹', icon: '📁' },
}

const fileTypeStats = computed(() => {
  if (!result.value) return []
  const map = new Map<string, number>()
  for (const h of result.value.results) {
    const ft = (h.meta?.fileType as string) || 'unknown'
    if (ft === 'unknown') continue
    map.set(ft, (map.get(ft) || 0) + 1)
  }
  if (map.size === 0) return [] // 无网盘结果时不显示
  return [...map.entries()]
    .map(([key, count]) => ({ key, count, ...(FILE_TYPE_META[key] || { label: key, icon: '❓' }) }))
    .sort((a, b) => b.count - a.count)
})

// ── 结果过滤 ──
const filteredResults = computed<SearchHit[]>(() => {
  if (!result.value) return []
  return result.value.results.filter((h) => {
    const cat = (h.meta?.category as string) || 'general'
    if (activeCategory.value !== 'all' && cat !== activeCategory.value) return false
    if (activeSource.value && h.source !== activeSource.value) return false
    if (activeFileType.value !== 'all') {
      const ft = (h.meta?.fileType as string) || 'unknown'
      if (ft !== activeFileType.value) return false
    }
    return true
  })
})

const patterns = computed(() => (query.value ? [query.value] : []))

function openUrl(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div class="search-root" :class="{ dark: app.darkMode }">
    <div class="bg-layer" aria-hidden="true" />

    <!-- ── 顶部导航 ── -->
    <nav class="top-nav">
      <div class="nav-left">
        <button class="nav-btn" @click="router.push('/dashboard')">
          用户中心
        </button>
      </div>
      <div class="nav-right">
        <button class="nav-btn" @click="app.toggleDark()">
          {{ app.darkMode ? '☀️' : '🌙' }}
        </button>
        <template v-if="auth.isLoggedIn">
          <button class="nav-btn" @click="router.push('/dashboard')">
            {{ auth.user?.username || '我的' }}
          </button>
        </template>
        <template v-else>
          <button class="nav-btn nav-btn-primary" @click="router.push('/login')">
            登录
          </button>
          <button class="nav-btn" @click="router.push('/register')">
            注册
          </button>
        </template>
      </div>
    </nav>

    <!-- ── 品牌 + 搜索框 ── -->
    <header class="hero" :class="{ compact: state === 'done' || state === 'loading' || state === 'error' }">
      <div class="wordmark">
        <span class="radar" aria-hidden="true"><i /><i /><i /></span>
        <h1 class="brand">觅源</h1>
        <p class="tagline">SEEKALL · 全网绿色资源聚合搜索 · 13 源并行</p>
      </div>

      <div class="searchbar">
        <span class="lens" aria-hidden="true">⌕</span>
        <input
          v-model="query"
          class="search-input"
          type="text"
          placeholder="搜索软件、游戏、动漫、网盘资源…"
          maxlength="100"
          @keydown.enter="doSearch()"
        />
        <button
          class="go-btn"
          :disabled="state === 'loading' || !query.trim()"
          @click="doSearch()"
        >
          <span v-if="state === 'loading'" class="spinner" />
          <span v-else>搜索</span>
        </button>
      </div>

      <div class="pan-toggle">
        <NCheckbox v-model:checked="includePan">
          <span class="pan-toggle-label">含网盘搜索</span>
        </NCheckbox>
        <span class="pan-toggle-hint">无头浏览器渲染，较慢（~20s）</span>
      </div>

      <!-- 初始态：热门搜索 -->
      <div v-if="state === 'idle'" class="hot">
        <span class="hot-label">试试：</span>
        <button v-for="h in hotWords" :key="h" class="hot-chip" @click="pickHot(h)">
          {{ h }}
        </button>
      </div>
    </header>

    <!-- ── 内容区 ── -->
    <main class="content">
      <!-- 加载态 -->
      <div v-if="state === 'loading'" class="loading">
        <div class="loading-status">
          <span class="dot-pulse"><i /><i /><i /></span>
          正在并行检索 {{ includePan ? '17' : '13' }} 个资源站…
        </div>
        <div v-for="n in 6" :key="n" class="skeleton-card">
          <NSkeleton height="20px" width="60%" />
          <NSkeleton height="14px" width="90%" style="margin-top: 12px" />
          <NSkeleton height="14px" width="40%" style="margin-top: 8px" />
        </div>
      </div>

      <!-- 错误态 -->
      <div v-else-if="state === 'error'" class="error-box">
        <div class="error-emoji">🛰️</div>
        <p>{{ errorMsg || '搜索出错了' }}</p>
        <NButton type="primary" @click="doSearch()">重试</NButton>
      </div>

      <!-- 结果态 -->
      <template v-else-if="state === 'done' && result">
        <!-- 汇总条 -->
        <div class="summary">
          <span class="summary-num">{{ result.total }}</span>
          <span class="summary-label">条结果</span>
          <span class="summary-sep">·</span>
          <span>{{ result.sources.length }} 个来源</span>
          <span class="summary-sep">·</span>
          <span class="mono">{{ result.elapsedMs }}ms</span>
          <span class="summary-spacer" />
          <NButton size="small" quaternary @click="exportCsv('all')">导出全部 CSV</NButton>
          <NButton size="small" quaternary @click="exportCsv('filtered')">导出筛选后 CSV</NButton>
        </div>

        <!-- 分类筛选 -->
        <div class="filters">
          <button
            class="cat-chip"
            :class="{ active: activeCategory === 'all' }"
            @click="activeCategory = 'all'; activeSource = ''"
          >
            全部
          </button>
          <button
            v-for="c in categories"
            :key="c.key"
            class="cat-chip"
            :class="{ active: activeCategory === c.key }"
            :style="activeCategory === c.key ? { background: c.color, borderColor: c.color } : {}"
            @click="activeCategory = c.key; activeSource = ''"
          >
            {{ c.label }}<span class="chip-count">{{ c.count }}</span>
          </button>
        </div>

        <!-- 来源筛选 -->
        <div v-if="result.sources.length" class="sources">
          <button
            class="src-chip"
            :class="{ active: activeSource === '' }"
            @click="activeSource = ''"
          >
            全部来源
          </button>
          <button
            v-for="s in result.sources"
            :key="s.domain"
            class="src-chip"
            :class="{ active: activeSource === s.domain }"
            @click="activeSource = activeSource === s.domain ? '' : s.domain"
          >
            {{ s.label }}<span class="chip-count">{{ s.count }}</span>
          </button>
        </div>

        <!-- 文件类型筛选（仅网盘结果存在时显示） -->
        <div v-if="fileTypeStats.length" class="sources">
          <span class="filter-label">文件类型</span>
          <button
            class="src-chip"
            :class="{ active: activeFileType === 'all' }"
            @click="activeFileType = 'all'"
          >
            全部
          </button>
          <button
            v-for="ft in fileTypeStats"
            :key="ft.key"
            class="src-chip"
            :class="{ active: activeFileType === ft.key }"
            @click="activeFileType = activeFileType === ft.key ? 'all' : ft.key"
          >
            {{ ft.icon }} {{ ft.label }}<span class="chip-count">{{ ft.count }}</span>
          </button>
        </div>

        <!-- 结果列表 -->
        <div v-if="filteredResults.length" class="results">
          <article
            v-for="(hit, i) in filteredResults"
            :key="hit.url + i"
            class="result-card"
            :style="{ animationDelay: `${Math.min(i, 20) * 35}ms` }"
            @click="openUrl(hit.url)"
          >
            <div class="result-head">
              <span
                class="src-badge"
                :style="{ background: catMeta((hit.meta?.category as string) || 'general').color + '1a', color: catMeta((hit.meta?.category as string) || 'general').color }"
              >
                {{ hit.source }}
              </span>
              <span class="cat-tag" :style="{ color: catMeta((hit.meta?.category as string) || 'general').color }">
                {{ catMeta((hit.meta?.category as string) || 'general').label }}
              </span>
            </div>
            <h3 class="result-title">
              <NHighlight :text="hit.title" :patterns="patterns" highlight-tag="mark" />
            </h3>
            <p v-if="hit.snippet" class="result-snippet">
              <NHighlight :text="hit.snippet" :patterns="patterns" highlight-tag="mark" />
            </p>
            <span class="result-url mono">{{ hit.url }}</span>
          </article>
        </div>
        <div v-else class="no-filter">
          <NEmpty description="该筛选条件下没有结果，换个分类试试" />
        </div>
      </template>

      <!-- 初始态：引导 -->
      <div v-else-if="state === 'idle'" class="idle-hint">
        <div class="hint-grid">
          <div class="hint-item hint-clickable" @click="pickCategory('software')"><span class="hint-ico">🧩</span><b>软件</b>绿色版 / 便携版 / 特别版</div>
          <div class="hint-item hint-clickable" @click="pickCategory('game')"><span class="hint-ico">🎮</span><b>游戏</b>Galgame / 单机资源</div>
          <div class="hint-item hint-clickable" @click="pickCategory('anime')"><span class="hint-ico">🌸</span><b>动漫</b>番剧 / 花园 / 蜜柑</div>
          <div class="hint-item hint-clickable" @click="pickCategory('pan')"><span class="hint-ico">☁️</span><b>网盘</b>夸克 / 阿里云盘 / 百度</div>
        </div>

        <!-- 资源榜单：热门 / 最新入库（MeiliSearch 沉淀，无数据则隐藏） -->
        <div v-if="hotResources.length || latestLoaded" class="boards">
          <div v-if="hotResources.length" class="board">
            <div class="board-head"><span class="board-ico">🔥</span>热门资源</div>
            <button
              v-for="(r, i) in hotResources"
              :key="r.id"
              class="board-item"
              @click="openResource(r.url)"
            >
              <span class="board-rank" :class="{ top: i < 3 }">{{ i + 1 }}</span>
              <span class="board-title">{{ r.title }}</span>
              <span v-if="r.category" class="board-cat" :style="{ color: catMeta(r.category).color }">
                {{ catMeta(r.category).label }}
              </span>
            </button>
          </div>

          <div v-if="latestLoaded" class="board">
            <div class="board-head"><span class="board-ico">🆕</span>最新入库</div>
            <div class="range-row">
              <button
                v-for="opt in RANGE_OPTIONS"
                :key="opt.key"
                class="range-chip"
                :class="{ active: latestRange === opt.key }"
                @click="pickRange(opt.key)"
              >
                {{ opt.label }}
              </button>
            </div>
            <template v-if="latestResources.length">
              <button
                v-for="r in latestResources"
                :key="r.id"
                class="board-item"
                @click="openResource(r.url)"
              >
                <span class="board-title">{{ r.title }}</span>
                <span v-if="r.category" class="board-cat" :style="{ color: catMeta(r.category).color }">
                  {{ catMeta(r.category).label }}
                </span>
              </button>
            </template>
            <div v-else class="board-empty">该时间范围内暂无新入库资源</div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.search-root {
  /* 亮色变量 */
  --bg: #f4f7f4;
  --bg-wash: radial-gradient(1200px 500px at 50% -120px, rgba(14, 159, 110, 0.14), transparent 70%);
  --grid: rgba(14, 159, 110, 0.045);
  --text: #14201a;
  --text-soft: #4b5a52;
  --text-faint: #8a998f;
  --line: #dfe7e0;
  --card: #ffffff;
  --card-hover: #ffffff;
  --green: #0e9f6e;
  --green-deep: #0a6b4c;
  min-height: calc(100vh - 56px);
  position: relative;
  background: var(--bg);
  color: var(--text);
  overflow-x: hidden;
}
.search-root.dark {
  --bg: #0d1512;
  --bg-wash: radial-gradient(1200px 500px at 50% -120px, rgba(16, 185, 129, 0.16), transparent 70%);
  --grid: rgba(16, 185, 129, 0.05);
  --text: #e6efe9;
  --text-soft: #a7b6ac;
  --text-faint: #647069;
  --line: #1e2a24;
  --card: #131d18;
  --card-hover: #16241d;
  --green: #10b981;
  --green-deep: #34d399;
}
/* ── 顶部导航 ── */
.top-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 20px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
}
.search-root.dark .top-nav {
  background: rgba(13, 21, 18, 0.85);
}
.nav-left, .nav-right {
  display: flex;
  gap: 8px;
  align-items: center;
}
.nav-btn {
  padding: 6px 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--card);
  color: var(--text-soft);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.nav-btn:hover {
  border-color: var(--green);
  color: var(--green);
}
.nav-btn-primary {
  background: var(--green);
  color: #fff;
  border-color: var(--green);
}
.nav-btn-primary:hover {
  opacity: 0.9;
  color: #fff;
}
.bg-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image: var(--bg-wash),
    linear-gradient(var(--grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid) 1px, transparent 1px);
  background-size: 100% 100%, 44px 44px, 44px 44px;
  mask-image: linear-gradient(to bottom, black, transparent 75%);
}

/* ── Hero ── */
.hero {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 72px 20px 32px;
  transition: padding 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
.hero.compact {
  padding: 28px 20px 16px;
}
.wordmark {
  text-align: center;
  transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}
.hero.compact .wordmark {
  transform: scale(0.72);
  margin-bottom: -18px;
}
.brand {
  font-size: 64px;
  font-weight: 800;
  letter-spacing: 0.06em;
  margin: 0;
  background: linear-gradient(135deg, var(--green-deep), var(--green));
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  line-height: 1;
}
.hero.compact .brand {
  font-size: 40px;
}
.tagline {
  margin: 12px 0 0;
  font-size: 13px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--text-faint);
}
.radar {
  position: relative;
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 4px;
  vertical-align: middle;
}
.radar i {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid var(--green);
  opacity: 0;
  animation: ping 2.4s ease-out infinite;
}
.radar i:nth-child(2) { animation-delay: 0.8s; }
.radar i:nth-child(3) { animation-delay: 1.6s; }
@keyframes ping {
  0% { transform: scale(0.6); opacity: 0.8; }
  100% { transform: scale(3.4); opacity: 0; }
}

/* ── 搜索框 ── */
.searchbar {
  display: flex;
  align-items: center;
  gap: 4px;
  width: min(680px, 92vw);
  margin-top: 34px;
  padding: 8px 8px 8px 20px;
  background: var(--card);
  border: 1.5px solid var(--line);
  border-radius: 999px;
  box-shadow: 0 12px 40px -18px rgba(14, 159, 110, 0.4);
  transition: border-color 0.25s, box-shadow 0.25s, transform 0.25s;
}
.searchbar:focus-within {
  border-color: var(--green);
  box-shadow: 0 18px 50px -16px rgba(14, 159, 110, 0.55);
  transform: translateY(-2px);
}
.lens {
  font-size: 22px;
  color: var(--green);
  line-height: 1;
}
.search-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 17px;
  color: var(--text);
  padding: 12px 8px;
  font-family: inherit;
}
.search-input::placeholder {
  color: var(--text-faint);
}
.go-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 84px;
  height: 46px;
  border: none;
  border-radius: 999px;
  background: linear-gradient(135deg, var(--green-deep), var(--green));
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.2s, opacity 0.2s;
}
.go-btn:hover:not(:disabled) {
  transform: scale(1.04);
  box-shadow: 0 8px 20px -6px rgba(14, 159, 110, 0.6);
}
.go-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.spinner {
  width: 18px;
  height: 18px;
  border: 2.5px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── 热门搜索 ── */
.hot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 22px;
  justify-content: center;
}
.pan-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  justify-content: center;
}
.pan-toggle-label {
  font-size: 13px;
}
.pan-toggle-hint {
  font-size: 12px;
  color: var(--text-faint);
}
.hot-label {
  font-size: 13px;
  color: var(--text-faint);
}
.hot-chip {
  padding: 6px 14px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--card);
  color: var(--text-soft);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.hot-chip:hover {
  border-color: var(--green);
  color: var(--green);
  transform: translateY(-1px);
}

/* ── 内容区 ── */
.content {
  position: relative;
  z-index: 1;
  max-width: 820px;
  margin: 0 auto;
  padding: 12px 20px 80px;
}

/* ── 加载 ── */
.loading-status {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text-soft);
  font-size: 14px;
  margin-bottom: 20px;
}
.dot-pulse {
  display: inline-flex;
  gap: 4px;
}
.dot-pulse i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--green);
  animation: bounce 1.2s ease-in-out infinite;
}
.dot-pulse i:nth-child(2) { animation-delay: 0.15s; }
.dot-pulse i:nth-child(3) { animation-delay: 0.3s; }
@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-6px); opacity: 1; }
}
.skeleton-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 20px;
  margin-bottom: 14px;
}

/* ── 错误 ── */
.error-box {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-soft);
}
.error-emoji {
  font-size: 48px;
  margin-bottom: 12px;
}

/* ── 汇总 ── */
.summary {
  display: flex;
  align-items: baseline;
  gap: 6px;
  font-size: 14px;
  color: var(--text-soft);
  margin-bottom: 16px;
}
.summary-num {
  font-size: 32px;
  font-weight: 800;
  color: var(--green);
  line-height: 1;
}
.summary-label {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}
.summary-sep {
  color: var(--text-faint);
  margin: 0 2px;
}
.summary-spacer {
  flex: 1;
}
.mono {
  font-family: 'Fira Code', ui-monospace, monospace;
  font-size: 13px;
}

/* ── 筛选 chips ── */
.filters, .sources {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.sources {
  margin-bottom: 24px;
  padding-top: 4px;
}
.filter-label {
  font-size: 12px;
  color: var(--text-faint);
  margin-right: 4px;
}
.cat-chip, .src-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 13px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--card);
  color: var(--text-soft);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}
.cat-chip:hover, .src-chip:hover {
  border-color: var(--green);
}
.cat-chip.active, .src-chip.active {
  background: var(--green);
  border-color: var(--green);
  color: #fff;
}
.chip-count {
  font-family: 'Fira Code', monospace;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.08);
}
.cat-chip.active .chip-count, .src-chip.active .chip-count {
  background: rgba(255, 255, 255, 0.25);
}

/* ── 结果卡片 ── */
.results {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.result-card {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 18px 20px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.25s, border-color 0.25s, background 0.25s;
  opacity: 0;
  animation: rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
@keyframes rise {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}
.result-card:hover {
  transform: translateY(-3px);
  border-color: var(--green);
  background: var(--card-hover);
  box-shadow: 0 16px 40px -20px rgba(14, 159, 110, 0.45);
}
.result-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.src-badge {
  font-family: 'Fira Code', monospace;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 6px;
  letter-spacing: 0.02em;
}
.cat-tag {
  font-size: 12px;
  font-weight: 600;
}
.result-title {
  font-size: 17px;
  font-weight: 600;
  line-height: 1.4;
  margin: 0 0 6px;
  color: var(--text);
}
.result-card:hover .result-title {
  color: var(--green);
}
.result-snippet {
  font-size: 13.5px;
  line-height: 1.65;
  color: var(--text-soft);
  margin: 0 0 10px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.result-url {
  color: var(--text-faint);
  font-size: 12px;
  word-break: break-all;
}
.result-title :deep(mark), .result-snippet :deep(mark) {
  background: transparent;
  color: var(--green);
  font-weight: 700;
  padding: 0;
}

/* ── 初始引导 ── */
.idle-hint {
  margin-top: 24px;
}
.hint-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
}
.hint-item {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 20px;
  font-size: 13px;
  color: var(--text-soft);
  line-height: 1.5;
  transition: transform 0.2s, border-color 0.2s;
}
.hint-item:hover {
  transform: translateY(-3px);
  border-color: var(--green);
}
.hint-clickable {
  cursor: pointer;
  user-select: none;
}
.hint-clickable:active {
  transform: scale(0.97);
  transition: transform 0.1s;
}
.hint-item b {
  display: block;
  color: var(--text);
  font-size: 15px;
  margin: 8px 0 2px;
}
.hint-ico {
  font-size: 26px;
}

/* ── 资源榜单 ── */
.boards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
  margin-top: 14px;
}
.board {
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 16px;
  padding: 16px 16px 8px;
}
.board-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 10px;
}
.board-ico {
  font-size: 16px;
}
.range-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.range-chip {
  padding: 3px 10px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: transparent;
  color: var(--text-faint);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.range-chip:hover {
  border-color: var(--green);
  color: var(--green);
}
.range-chip.active {
  background: var(--green);
  border-color: var(--green);
  color: #fff;
}
.board-empty {
  padding: 14px 6px;
  font-size: 12.5px;
  color: var(--text-faint);
}
.board-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 6px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-soft);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}
.board-item:hover {
  background: rgba(14, 159, 110, 0.08);
}
.board-item:hover .board-title {
  color: var(--green);
}
.board-rank {
  flex-shrink: 0;
  width: 18px;
  font-family: 'Fira Code', monospace;
  font-size: 12px;
  color: var(--text-faint);
}
.board-rank.top {
  color: var(--green);
  font-weight: 700;
}
.board-title {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color 0.15s;
}
.board-cat {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
}
.no-filter {
  padding: 40px 0;
}

@media (max-width: 640px) {
  .brand { font-size: 48px; }
  .hero.compact .brand { font-size: 34px; }
  .hint-grid { grid-template-columns: 1fr; }
  .boards { grid-template-columns: 1fr; }
}
</style>
