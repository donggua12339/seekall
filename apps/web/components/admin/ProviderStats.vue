<template>
  <div>
    <div class="mb-4 flex items-center justify-between flex-wrap gap-3">
      <div class="text-sm text-gray-500">
        实时统计 Provider 成功率、响应时间、健康度评分、熔断器状态
      </div>
      <div class="flex items-center gap-2">
        <n-switch v-model:value="autoRefresh" size="small">
          <template #checked>自动刷新 10s</template>
          <template #unchecked>手动</template>
        </n-switch>
        <n-button size="small" :loading="loading" @click="loadStats">
          刷新
        </n-button>
        <n-button size="small" quaternary @click="recoverCheck" :loading="recovering">
          恢复检查
        </n-button>
      </div>
    </div>

    <n-empty v-if="!loading && !stats?.length" description="暂无数据" class="py-8" />

    <div v-else class="space-y-3">
      <n-card v-for="p in stats" :key="p.name" class="provider-card">
        <!-- 头部：名称 + 状态标签 + 操作按钮 -->
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-lg font-semibold">{{ p.name }}</span>
            <n-tag :type="scoreType(p.score)" size="small">
              健康度 {{ p.score }}
            </n-tag>
            <n-tag :type="circuitTagType(p.circuitState)" size="small" :bordered="false">
              {{ circuitLabel(p.circuitState) }}
            </n-tag>
            <n-tag v-if="p.autoDisabled" type="error" size="small" :bordered="false">
              已自动降级
            </n-tag>
          </div>
          <div class="flex items-center gap-2">
            <n-button
              v-if="!p.autoDisabled"
              size="tiny"
              type="warning"
              ghost
              @click="disableProvider(p.name)"
            >
              手动禁用
            </n-button>
            <n-button
              v-else
              size="tiny"
              type="success"
              ghost
              @click="enableProvider(p.name)"
            >
              恢复
            </n-button>
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
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
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
          <div>
            <div class="text-gray-500">最近失败</div>
            <div class="font-semibold" :class="p.lastFailAt ? 'text-red-500' : ''">
              {{ formatTime(p.lastFailAt) }}
            </div>
          </div>
        </div>

        <!-- 自动降级原因 -->
        <div v-if="p.autoDisabled && p.autoDisabledReason" class="mt-3 text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded p-2">
          <strong>降级原因：</strong>{{ p.autoDisabledReason }}
          <span v-if="p.autoDisabledAt" class="ml-2 text-gray-500">
            （{{ formatTime(p.autoDisabledAt) }}）
          </span>
        </div>
      </n-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NCard, NTag, NEmpty, NButton, NSwitch, useMessage } from 'naive-ui'
import { ref, onMounted, onUnmounted, watch } from 'vue'

interface ProviderStat {
  name: string
  successCount: number
  failCount: number
  avgDurationMs: number
  lastSuccessAt: number | null
  lastFailAt: number | null
  score: number
  autoDisabled: boolean
  autoDisabledAt: number | null
  autoDisabledReason?: string
  circuitState: 'closed' | 'open' | 'half-open'
}

const { api } = useApi()
const message = useMessage()

const loading = ref(false)
const recovering = ref(false)
const stats = ref<ProviderStat[]>([])
const autoRefresh = ref(false)
let timer: ReturnType<typeof setInterval> | null = null

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

function circuitLabel(state: ProviderStat['circuitState']): string {
  switch (state) {
    case 'closed': return '正常'
    case 'open': return '熔断中'
    case 'half-open': return '半开试探'
  }
}

function circuitTagType(state: ProviderStat['circuitState']): 'success' | 'error' | 'warning' {
  switch (state) {
    case 'closed': return 'success'
    case 'open': return 'error'
    case 'half-open': return 'warning'
  }
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
    const data = await api.get<{ providers: ProviderStat[] }>('/admin/provider-stats')
    stats.value = data.providers
  } catch {
    stats.value = []
  } finally {
    loading.value = false
  }
}

async function disableProvider(name: string) {
  try {
    await api.post(`/admin/providers/${encodeURIComponent(name)}/disable`, { name: 'manual' })
    message.success(`已禁用 ${name}`)
    await loadStats()
  } catch (e) {
    message.error('禁用失败')
  }
}

async function enableProvider(name: string) {
  try {
    await api.post(`/admin/providers/${encodeURIComponent(name)}/enable`)
    message.success(`已恢复 ${name}`)
    await loadStats()
  } catch {
    message.error('恢复失败')
  }
}

async function recoverCheck() {
  recovering.value = true
  try {
    const res = await api.post<{ recovered: string[]; stillDown: string[] }>('/admin/providers/recover-check')
    if (res.recovered.length > 0) {
      message.success(`已恢复: ${res.recovered.join(', ')}`)
    } else {
      message.info('没有可恢复的 Provider')
    }
    await loadStats()
  } catch {
    message.error('恢复检查失败')
  } finally {
    recovering.value = false
  }
}

watch(autoRefresh, (val) => {
  if (val) {
    timer = setInterval(loadStats, 10000)
  } else if (timer) {
    clearInterval(timer)
    timer = null
  }
})

onMounted(loadStats)
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
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
