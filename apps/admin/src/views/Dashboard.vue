<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import {
  NCard,
  NGrid,
  NGridItem,
  NStatistic,
  NSpin,
  NTag,
  NList,
  NListItem,
  NThing,
  NTime,
  NEmpty,
  NSelect,
  NSpace,
  NText,
} from 'naive-ui'
import { adminApi, type Dashboard, type AuditLog, type Analytics } from '@/api/admin'
import { dmcaApi, type TransparencyReport } from '@/api/dmca'
import { getBulkWeeklyDownloads, SEEKALL_PACKAGES } from '@/api/npm'

const loading = ref(true)
const dashboard = ref<Dashboard | null>(null)
const transparency = ref<TransparencyReport | null>(null)
const recentLogs = ref<AuditLog[]>([])
const npmDownloads = ref<Record<string, number>>({})
const totalNpmDownloads = ref(0)

// Analytics 合并
const analyticsLoading = ref(false)
const analytics = ref<Analytics | null>(null)
const days = ref(7)
const dayOptions = [
  { label: '最近 7 天', value: 7 },
  { label: '最近 30 天', value: 30 },
  { label: '最近 90 天', value: 90 },
]

async function loadDashboard() {
  loading.value = true
  try {
    const results = await Promise.allSettled([
      adminApi.dashboard(),
      dmcaApi.transparency(),
      adminApi.auditLogs({ page: 1, pageSize: 5 }),
    ])
    if (results[0].status === 'fulfilled') dashboard.value = results[0].value
    if (results[1].status === 'fulfilled') transparency.value = results[1].value
    if (results[2].status === 'fulfilled') recentLogs.value = results[2].value.list

    getBulkWeeklyDownloads(SEEKALL_PACKAGES)
      .then((stats) => {
        npmDownloads.value = stats
        totalNpmDownloads.value = Object.values(stats).reduce((a, b) => a + b, 0)
      })
      .catch(() => {})
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

async function loadAnalytics() {
  analyticsLoading.value = true
  try {
    analytics.value = await adminApi.analytics(days.value)
  } catch (err) {
    console.error(err)
  } finally {
    analyticsLoading.value = false
  }
}

watch(days, loadAnalytics)
onMounted(() => {
  loadDashboard()
  loadAnalytics()
})
</script>

<template>
  <NSpin :show="loading">
    <!-- 核心指标 -->
    <NGrid :cols="4" :x-gap="16" :y-gap="16">
      <NGridItem>
        <NCard>
          <NStatistic label="总用户数" :value="dashboard?.userCount ?? 0" />
        </NCard>
      </NGridItem>
      <NGridItem>
        <NCard>
          <NStatistic label="付费用户" :value="dashboard?.paidUserCount ?? 0">
            <template #suffix>
              <NTag size="small" type="success" round>paid</NTag>
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
      <NGridItem>
        <NCard>
          <NStatistic label="License 总数" :value="dashboard?.licenseCount ?? 0" />
        </NCard>
      </NGridItem>
      <NGridItem>
        <NCard>
          <NStatistic label="已发布规则" :value="dashboard?.ruleCount ?? 0" />
        </NCard>
      </NGridItem>
    </NGrid>

    <!-- 数据分析（合并自原 Analytics 页面） -->
    <NCard style="margin-top: 16px">
      <template #header>
        <NSpace justify="space-between" align="center">
          <NText strong style="font-size: 16px">数据分析</NText>
          <NSelect v-model:value="days" :options="dayOptions" style="width: 160px" size="small" />
        </NSpace>
      </template>
      <NSpin :show="analyticsLoading">
        <NGrid :cols="5" :x-gap="16" :y-gap="16">
          <NGridItem>
            <NStatistic label="新用户" :value="analytics?.metrics.newUsers ?? 0">
              <template #suffix><NTag size="small" type="info" round>users</NTag></template>
            </NStatistic>
          </NGridItem>
          <NGridItem>
            <NStatistic label="新 License" :value="analytics?.metrics.newLicenses ?? 0">
              <template #suffix><NTag size="small" type="success" round>licenses</NTag></template>
            </NStatistic>
          </NGridItem>
          <NGridItem>
            <NStatistic label="新规则" :value="analytics?.metrics.newRules ?? 0">
              <template #suffix><NTag size="small" type="warning" round>rules</NTag></template>
            </NStatistic>
          </NGridItem>
          <NGridItem>
            <NStatistic label="规则评审" :value="analytics?.metrics.reviews ?? 0">
              <template #suffix><NTag size="small" :bordered="false">reviews</NTag></template>
            </NStatistic>
          </NGridItem>
          <NGridItem>
            <NStatistic label="规则下架" :value="analytics?.metrics.takedowns ?? 0">
              <template #suffix><NTag size="small" type="error" round>takedowns</NTag></template>
            </NStatistic>
          </NGridItem>
        </NGrid>
      </NSpin>
    </NCard>

    <!-- npm 下载量 -->
    <NCard title="npm 下载量(上周)" style="margin-top: 16px">
      <NGrid :cols="4" :x-gap="16" :y-gap="16">
        <NGridItem>
          <NStatistic label="总下载量" :value="totalNpmDownloads" />
        </NGridItem>
        <NGridItem>
          <NStatistic label="@seekall/sdk" :value="npmDownloads['@seekall/sdk'] ?? 0" />
        </NGridItem>
        <NGridItem>
          <NStatistic
            label="L0 规则"
            :value="
              (npmDownloads['@seekall/rule-arxiv'] ?? 0) +
              (npmDownloads['@seekall/rule-crossref'] ?? 0) +
              (npmDownloads['@seekall/rule-pubmed'] ?? 0)
            "
          />
        </NGridItem>
        <NGridItem>
          <NStatistic
            label="L2 规则"
            :value="
              Object.entries(npmDownloads)
                .filter(([k]) => !k.endsWith('sdk') && !k.includes('arxiv') && !k.includes('crossref') && !k.includes('pubmed') && !k.includes('github') && !k.includes('hackernews'))
                .reduce((a, [, v]) => a + v, 0)
            "
          />
        </NGridItem>
      </NGrid>
    </NCard>

    <!-- 透明度报告 -->
    <NCard title="透明度报告" style="margin-top: 16px">
      <NGrid :cols="5" :x-gap="16" :y-gap="16">
        <NGridItem>
          <NStatistic label="收到举报" :value="transparency?.totalNotices ?? 0" />
        </NGridItem>
        <NGridItem>
          <NStatistic label="已执行下架" :value="transparency?.actioned ?? 0">
            <template #suffix><NTag size="small" type="success" round>actioned</NTag></template>
          </NStatistic>
        </NGridItem>
        <NGridItem>
          <NStatistic label="待处理" :value="transparency?.pending ?? 0">
            <template #suffix>
              <NTag size="small" :type="(transparency?.pending ?? 0) > 0 ? 'warning' : 'default'" round>pending</NTag>
            </template>
          </NStatistic>
        </NGridItem>
        <NGridItem>
          <NStatistic label="拒绝（误报）" :value="transparency?.rejected ?? 0" />
        </NGridItem>
        <NGridItem>
          <NStatistic label="平均响应（小时）" :value="transparency?.avgResponseHours ?? 0" :precision="1" />
        </NGridItem>
      </NGrid>
    </NCard>

    <!-- 最近审计日志 -->
    <NCard title="最近审计日志" style="margin-top: 16px">
      <NList v-if="recentLogs.length > 0" bordered>
        <NListItem v-for="log in recentLogs" :key="log.id">
          <NThing>
            <template #header>
              <NTag size="small" :bordered="false">{{ log.action }}</NTag>
              <span style="margin-left: 8px; color: #666">{{ log.targetType }}</span>
            </template>
            <template #description>
              <span>{{ log.admin?.username || 'system' }}</span>
              <span style="margin-left: 8px">
                <NTime :time="new Date(log.createdAt)" type="datetime" />
              </span>
            </template>
          </NThing>
        </NListItem>
      </NList>
      <NEmpty v-else description="暂无审计日志" />
    </NCard>
  </NSpin>
</template>
