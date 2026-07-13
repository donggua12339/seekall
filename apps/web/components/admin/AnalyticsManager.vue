<template>
  <div>
    <!-- 时间范围选择 -->
    <div class="mb-4 flex items-center gap-3">
      <span>时间范围：</span>
      <n-radio-group v-model:value="days" size="small" @update:value="loadAnalytics">
        <n-radio-button :value="7">近 7 天</n-radio-button>
        <n-radio-button :value="30">近 30 天</n-radio-button>
        <n-radio-button :value="90">近 90 天</n-radio-button>
      </n-radio-group>
    </div>

    <!-- 概览卡片 -->
    <div v-if="analytics" class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <n-statistic label="总搜索次数" :value="analytics.summary.totalSearches" />
      <n-statistic label="总用户数" :value="analytics.summary.totalUsers" />
      <n-statistic label="DAU" :value="analytics.summary.dau" />
      <n-statistic label="MAU" :value="analytics.summary.mau" />
      <n-statistic label="WAU" :value="analytics.summary.wau" />
      <n-statistic label="人均搜索" :value="analytics.summary.avgSearchesPerUser" />
    </div>

    <!-- 搜索趋势 -->
    <n-card title="搜索趋势" class="mb-4" v-if="analytics?.trend?.length">
      <div class="trend-chart">
        <div
          v-for="item in analytics.trend"
          :key="item.date"
          class="trend-bar"
          :style="{ height: getBarHeight(item.count) + '%' }"
          :title="`${item.date}: ${item.count} 次`"
        >
          <span class="trend-value">{{ item.count }}</span>
          <span class="trend-date">{{ item.date.slice(5) }}</span>
        </div>
      </div>
    </n-card>

    <!-- 热门关键词 -->
    <n-card title="热门关键词 Top 20" v-if="analytics?.topKeywords?.length">
      <div class="keyword-list">
        <div v-for="(item, idx) in analytics.topKeywords" :key="item.keyword" class="keyword-item">
          <span class="keyword-rank">{{ idx + 1 }}</span>
          <span class="keyword-text">{{ item.keyword }}</span>
          <span class="keyword-count">{{ item.count }} 次</span>
        </div>
      </div>
    </n-card>

    <n-empty v-if="!loading && !analytics" description="暂无数据" class="py-8" />
  </div>
</template>

<script setup lang="ts">
import { NStatistic, NCard, NRadioButton, NRadioGroup, NEmpty } from 'naive-ui'
import { ref, onMounted, computed } from 'vue'

const { api } = useApi()

const days = ref(7)
const loading = ref(false)
const analytics = ref<{
  summary: {
    totalSearches: number
    totalUsers: number
    dau: number
    wau: number
    mau: number
    avgSearchesPerUser: number
  }
  trend: Array<{ date: string; count: number }>
  topKeywords: Array<{ keyword: string; count: number }>
} | null>(null)

const maxCount = computed(() => {
  if (!analytics.value?.trend?.length) return 1
  return Math.max(...analytics.value.trend.map((t) => t.count), 1)
})

function getBarHeight(count: number): number {
  return Math.max(5, (count / maxCount.value) * 100)
}

async function loadAnalytics() {
  loading.value = true
  try {
    analytics.value = await api.get('/admin/analytics', { days: days.value })
  } catch {
    analytics.value = null
  } finally {
    loading.value = false
  }
}

onMounted(loadAnalytics)
</script>

<style scoped>
.trend-chart {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 200px;
  padding: 16px 0;
  overflow-x: auto;
}

.trend-bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  min-width: 40px;
  background: linear-gradient(180deg, #6366f1 0%, #8b5cf6 100%);
  border-radius: 4px 4px 0 0;
  padding: 4px;
  position: relative;
  transition: opacity 0.2s;
}

.trend-bar:hover {
  opacity: 0.8;
}

.trend-value {
  font-size: 11px;
  color: #fff;
  margin-bottom: 4px;
}

.trend-date {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.8);
  white-space: nowrap;
}

.keyword-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 8px;
}

.keyword-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(99, 102, 241, 0.05);
  border-radius: 6px;
}

.keyword-rank {
  font-weight: bold;
  color: #6366f1;
  min-width: 24px;
}

.keyword-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.keyword-count {
  font-size: 12px;
  color: #6b7280;
}
</style>
