<template>
  <div>
    <div class="mb-4 text-sm text-gray-500">
      实时统计 Provider 成功率、平均响应时间、健康度评分（0-100）
    </div>

    <n-empty v-if="!loading && !stats?.length" description="暂无数据" class="py-8" />

    <div v-else class="space-y-3">
      <n-card v-for="p in stats" :key="p.name" class="provider-card">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-3">
            <span class="text-lg font-semibold">{{ p.name }}</span>
            <n-tag :type="scoreType(p.score)" size="small">
              健康度 {{ p.score }}
            </n-tag>
          </div>
          <div class="text-sm text-gray-500">
            成功 {{ p.successCount }} / 失败 {{ p.failCount }}
          </div>
        </div>

        <!-- 评分进度条 -->
        <div class="score-bar-container mb-3">
          <div
            class="score-bar"
            :style="{ width: p.score + '%', background: scoreColor(p.score) }"
          ></div>
        </div>

        <!-- 统计数据 -->
        <div class="grid grid-cols-3 gap-3 text-sm">
          <div>
            <div class="text-gray-500">成功率</div>
            <div class="font-semibold">{{ getSuccessRate(p) }}%</div>
          </div>
          <div>
            <div class="text-gray-500">平均响应</div>
            <div class="font-semibold">{{ p.avgDurationMs }}ms</div>
          </div>
          <div>
            <div class="text-gray-500">最近成功</div>
            <div class="font-semibold">{{ formatTime(p.lastSuccessAt) }}</div>
          </div>
        </div>
      </n-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NCard, NTag, NEmpty } from 'naive-ui'
import { ref, onMounted } from 'vue'

const { api } = useApi()

const loading = ref(false)
const stats = ref<Array<{
  name: string
  successCount: number
  failCount: number
  avgDurationMs: number
  lastSuccessAt: number | null
  lastFailAt: number | null
  score: number
}>>([])

function getSuccessRate(p: { successCount: number; failCount: number }): string {
  const total = p.successCount + p.failCount
  if (total === 0) return '-'
  return ((p.successCount / total) * 100).toFixed(1)
}

function scoreType(score: number): 'success' | 'warning' | 'error' {
  if (score >= 70) return 'success'
  if (score >= 40) return 'warning'
  return 'error'
}

function scoreColor(score: number): string {
  if (score >= 70) return 'linear-gradient(90deg, #10b981, #34d399)'
  if (score >= 40) return 'linear-gradient(90deg, #f59e0b, #fbbf24)'
  return 'linear-gradient(90deg, #ef4444, #f87171)'
}

function formatTime(ts: number | null): string {
  if (!ts) return '从未'
  const diff = Date.now() - ts
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前'
  return new Date(ts).toLocaleString()
}

async function loadStats() {
  loading.value = true
  try {
    const data = await api.get<{ providers: typeof stats.value }>('/admin/provider-stats')
    stats.value = data.providers
  } catch {
    stats.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadStats)
</script>

<style scoped>
.provider-card {
  transition: box-shadow 0.2s;
}

.provider-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.score-bar-container {
  height: 8px;
  background: rgba(0, 0, 0, 0.06);
  border-radius: 4px;
  overflow: hidden;
}

.score-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}
</style>
