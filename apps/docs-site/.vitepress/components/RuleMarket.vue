<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface MarketRule {
  id: string
  npmPackage: string
  riskLevel: number
  description: string
  status: string
  author?: { username: string }
  version?: string
}

const loading = ref(true)
const error = ref('')
const rules = ref<MarketRule[]>([])
const searchQuery = ref('')
const selectedRisk = ref<number | 'all'>('all')
const downloads = ref<Record<string, number>>({})

const riskLevels = [
  { value: 'all', label: '全部', color: '#666' },
  { value: 0, label: 'L0 学术', color: '#3aa675' },
  { value: 1, label: 'L1 开源', color: '#2080f0' },
  { value: 2, label: 'L2 付费', color: '#f0a020' },
]

const filteredRules = computed(() => {
  let result = rules.value
  if (selectedRisk.value !== 'all') {
    result = result.filter((r) => r.riskLevel === selectedRisk.value)
  }
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    result = result.filter(
      (r) =>
        r.npmPackage.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q),
    )
  }
  return result
})

async function loadRules() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch('https://seekall.winmelon.cn/api/v1/rules')
    const body = await res.json()
    if (body.code === 0) {
      rules.value = body.data || []
      // 加载完规则后,批量拉 npm 下载量(不阻塞渲染)
      loadDownloads()
    } else {
      error.value = body.message || '加载失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '网络错误'
  } finally {
    loading.value = false
  }
}

async function loadDownloads() {
  try {
    const packages = rules.value.map((r) => r.npmPackage).filter(Boolean)
    if (packages.length === 0) return
    // npm bulk API 最多 128 个包,逗号分隔
    const url = `https://api.npmjs.org/downloads/point/last-week/${packages
      .map(encodeURIComponent)
      .join(',')}`
    const res = await fetch(url)
    if (!res.ok) return
    const data = (await res.json()) as Record<string, { downloads: number }>
    const map: Record<string, number> = {}
    for (const [pkg, info] of Object.entries(data)) {
      map[pkg] = info.downloads
    }
    downloads.value = map
  } catch {
    // npm API 失败静默(不显示下载量)
  }
}

function copyInstall(pkg: string) {
  const cmd = `npm i ${pkg}`
  navigator.clipboard?.writeText(cmd)
}

function riskColor(level: number): string {
  return riskLevels.find((r) => r.value === level)?.color || '#666'
}

function riskLabel(level: number): string {
  return riskLevels.find((r) => r.value === level)?.label || `L${level}`
}

onMounted(loadRules)
</script>

<template>
  <div class="rule-market">
    <div class="filters">
      <input
        v-model="searchQuery"
        class="search-input"
        placeholder="搜索规则包名或描述..."
      />
      <div class="risk-filters">
        <button
          v-for="r in riskLevels"
          :key="r.value"
          class="risk-btn"
          :class="{ active: selectedRisk === r.value }"
          :style="{ borderColor: selectedRisk === r.value ? r.color : '' }"
          @click="selectedRisk = r.value"
        >
          <span class="risk-dot" :style="{ background: r.color }"></span>
          {{ r.label }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">加载中...</div>

    <div v-else-if="error" class="error">
      ⚠️ {{ error }}
      <button @click="loadRules" class="retry-btn">重试</button>
    </div>

    <div v-else-if="filteredRules.length === 0" class="empty">
      无匹配规则
    </div>

    <div v-else class="rule-grid">
      <div v-for="rule in filteredRules" :key="rule.id" class="rule-card">
        <div class="rule-header">
          <span class="risk-badge" :style="{ background: riskColor(rule.riskLevel) }">
            {{ riskLabel(rule.riskLevel) }}
          </span>
          <code class="pkg-name">{{ rule.npmPackage }}</code>
          <span v-if="rule.version" class="version">v{{ rule.version }}</span>
        </div>
        <p class="description">{{ rule.description }}</p>
        <div class="rule-footer">
          <span v-if="rule.author" class="author">@{{ rule.author.username }}</span>
          <span v-if="downloads[rule.npmPackage]" class="downloads">
            ⬇ {{ downloads[rule.npmPackage] }}/周
          </span>
          <button class="install-btn" @click="copyInstall(rule.npmPackage)">
            复制安装命令
          </button>
        </div>
      </div>
    </div>

    <div class="stats">
      共 {{ filteredRules.length }} / {{ rules.length }} 个规则
    </div>
  </div>
</template>

<style scoped>
.rule-market {
  margin: 24px 0;
}

.filters {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.search-input {
  padding: 10px 14px;
  border: 1px solid var(--vp-border-color, #e2e8f0);
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #3aa675;
}

.risk-filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.risk-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid var(--vp-border-color, #e2e8f0);
  border-radius: 20px;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.risk-btn.active {
  font-weight: 600;
}

.risk-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.loading,
.error,
.empty {
  text-align: center;
  padding: 40px;
  color: var(--vp-text-color-light, #666);
}

.retry-btn {
  margin-left: 8px;
  padding: 4px 12px;
  border: 1px solid #3aa675;
  border-radius: 4px;
  background: transparent;
  color: #3aa675;
  cursor: pointer;
}

.rule-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.rule-card {
  border: 1px solid var(--vp-border-color, #e2e8f0);
  border-radius: 10px;
  padding: 16px;
  transition: box-shadow 0.2s, transform 0.2s;
}

.rule-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.rule-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.risk-badge {
  color: white;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 10px;
}

.pkg-name {
  font-family: var(--vp-font-family-mono, monospace);
  font-size: 14px;
  font-weight: 600;
}

.version {
  font-size: 12px;
  color: var(--vp-text-color-light, #999);
}

.description {
  font-size: 13px;
  color: var(--vp-text-color, #333);
  margin: 8px 0 12px;
  line-height: 1.5;
}

.rule-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.author {
  font-size: 12px;
  color: var(--vp-text-color-light, #999);
}

.downloads {
  font-size: 12px;
  color: #3aa675;
  font-weight: 600;
}

.install-btn {
  padding: 4px 12px;
  border: 1px solid #3aa675;
  border-radius: 4px;
  background: transparent;
  color: #3aa675;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.install-btn:hover {
  background: #3aa675;
  color: white;
}

.stats {
  text-align: right;
  margin-top: 16px;
  font-size: 12px;
  color: var(--vp-text-color-light, #999);
}
</style>
