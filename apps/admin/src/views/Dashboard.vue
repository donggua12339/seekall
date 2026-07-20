<script setup lang="ts">
import { ref, onMounted } from 'vue'
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
} from 'naive-ui'
import { adminApi, type Dashboard, type AuditLog } from '@/api/admin'
import { dmcaApi, type TransparencyReport } from '@/api/dmca'

const loading = ref(true)
const dashboard = ref<Dashboard | null>(null)
const transparency = ref<TransparencyReport | null>(null)
const recentLogs = ref<AuditLog[]>([])

async function loadDashboard() {
  loading.value = true
  try {
    const [d, t, logs] = await Promise.all([
      adminApi.dashboard(),
      dmcaApi.transparency(),
      adminApi.auditLogs({ page: 1, pageSize: 5 }),
    ])
    dashboard.value = d
    transparency.value = t
    recentLogs.value = logs.list
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

onMounted(loadDashboard)
</script>

<template>
  <NSpin :show="loading">
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
          <NStatistic
            :label="`DMCA 举报 (${transparency?.month || '-'})`"
            :value="transparency?.totalNotices ?? 0"
          >
            <template #suffix>
              <NTag
                size="small"
                :type="(transparency?.totalNotices ?? 0) > 0 ? 'warning' : 'default'"
                round
              >
                {{ transparency?.actioned ?? 0 }} 已处理
              </NTag>
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
    </NGrid>

    <NCard title="透明度报告" style="margin-top: 16px;">
      <NGrid :cols="5" :x-gap="16" :y-gap="16">
        <NGridItem>
          <NStatistic label="收到举报" :value="transparency?.totalNotices ?? 0" />
        </NGridItem>
        <NGridItem>
          <NStatistic label="已执行下架" :value="transparency?.actioned ?? 0">
            <template #suffix>
              <NTag size="small" type="success" round>actioned</NTag>
            </template>
          </NStatistic>
        </NGridItem>
        <NGridItem>
          <NStatistic label="待处理" :value="transparency?.pending ?? 0">
            <template #suffix>
              <NTag
                size="small"
                :type="(transparency?.pending ?? 0) > 0 ? 'warning' : 'default'"
                round
              >
                pending
              </NTag>
            </template>
          </NStatistic>
        </NGridItem>
        <NGridItem>
          <NStatistic label="拒绝（误报）" :value="transparency?.rejected ?? 0" />
        </NGridItem>
        <NGridItem>
          <NStatistic
            label="平均响应（小时）"
            :value="transparency?.avgResponseHours ?? 0"
            :precision="1"
          />
        </NGridItem>
      </NGrid>
    </NCard>

    <NCard title="最近审计日志" style="margin-top: 16px;">
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
