<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import {
  NCard,
  NGrid,
  NGridItem,
  NStatistic,
  NSpin,
  NTag,
  NSelect,
  NSpace,
  NText,
} from 'naive-ui'
import { adminApi, type Analytics } from '@/api/admin'

const loading = ref(true)
const days = ref(7)
const analytics = ref<Analytics | null>(null)

const dayOptions = [
  { label: '最近 7 天', value: 7 },
  { label: '最近 30 天', value: 30 },
  { label: '最近 90 天', value: 90 },
]

async function loadAnalytics() {
  loading.value = true
  try {
    analytics.value = await adminApi.analytics(days.value)
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

watch(days, loadAnalytics)
onMounted(loadAnalytics)
</script>

<template>
  <NSpin :show="loading">
    <NCard>
      <NSpace justify="space-between" align="center">
        <NText strong style="font-size: 16px">时间窗口</NText>
        <NSelect v-model:value="days" :options="dayOptions" style="width: 200px" />
      </NSpace>
    </NCard>

    <NGrid :cols="5" :x-gap="16" :y-gap="16" style="margin-top: 16px">
      <NGridItem>
        <NCard>
          <NStatistic label="新用户" :value="analytics?.metrics.newUsers ?? 0">
            <template #suffix>
              <NTag size="small" type="info" round>users</NTag>
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
      <NGridItem>
        <NCard>
          <NStatistic label="新 License" :value="analytics?.metrics.newLicenses ?? 0">
            <template #suffix>
              <NTag size="small" type="success" round>licenses</NTag>
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
      <NGridItem>
        <NCard>
          <NStatistic label="新规则" :value="analytics?.metrics.newRules ?? 0">
            <template #suffix>
              <NTag size="small" type="warning" round>rules</NTag>
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
      <NGridItem>
        <NCard>
          <NStatistic label="规则评审" :value="analytics?.metrics.reviews ?? 0">
            <template #suffix>
              <NTag size="small" :bordered="false">reviews</NTag>
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
      <NGridItem>
        <NCard>
          <NStatistic label="规则下架" :value="analytics?.metrics.takedowns ?? 0">
            <template #suffix>
              <NTag size="small" type="error" round>takedowns</NTag>
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
    </NGrid>

    <NCard title="说明" style="margin-top: 16px">
      <NSpace vertical>
        <NText depth="3">
          统计窗口:
          {{ analytics?.since ? new Date(analytics.since).toLocaleString('zh-CN') : '-' }}
          至今
        </NText>
        <NText depth="3">
          数据基于 license / rule / adminAuditLog 表 createdAt 字段统计，不包含已删除记录。
        </NText>
        <NText depth="3">
          v0.5 极简版 analytics：暂无趋势图，后续 M2 阶段加按天/周分组的折线图。
        </NText>
      </NSpace>
    </NCard>
  </NSpin>
</template>
