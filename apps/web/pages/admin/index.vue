<template>
  <div class="min-h-screen bg-gray-50 dark:bg-gray-900">
    <header class="bg-indigo-600 text-white shadow">
      <div class="container mx-auto px-4 py-3 flex-between">
        <h1 class="text-xl font-bold">SeekAll 管理后台</h1>
        <div class="flex items-center gap-3">
          <span class="text-sm">{{ authStore.user?.username }}</span>
          <n-button size="small" quaternary @click="router.push('/')">回主站</n-button>
        </div>
      </div>
    </header>

    <div class="container mx-auto px-4 py-6">
      <n-tabs type="line" animated>
        <!-- 控制台 -->
        <n-tab-pane name="dashboard" tab="控制台">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <n-statistic label="总用户数" :value="dashboard?.users.total ?? 0" />
            <n-statistic label="付费用户" :value="dashboard?.users.paid ?? 0" />
            <n-statistic label="今日搜索" :value="dashboard?.searches.today ?? 0" />
            <n-statistic label="待处理举报" :value="dashboard?.takedown.pending ?? 0" />
          </div>
        </n-tab-pane>

        <!-- 用户管理 -->
        <n-tab-pane name="users" tab="用户管理">
          <n-data-table :columns="userColumns" :data="users" :loading="loadingUsers" :pagination="userPagination" />
        </n-tab-pane>

        <!-- 邀请码管理 -->
        <n-tab-pane name="invite-codes" tab="邀请码">
          <InviteCodeManager />
        </n-tab-pane>

        <!-- 会员激活码管理 -->
        <n-tab-pane name="membership-codes" tab="会员激活码">
          <MembershipCodeManager />
        </n-tab-pane>

        <!-- 侵权举报 -->
        <n-tab-pane name="takedown" tab="侵权举报">
          <TakedownManager />
        </n-tab-pane>

        <!-- 黑名单 -->
        <n-tab-pane name="blocked-keywords" tab="关键词黑名单">
          <BlockedKeywordManager />
        </n-tab-pane>

        <!-- 审计日志 -->
        <n-tab-pane name="audit-logs" tab="审计日志">
          <n-data-table :columns="auditColumns" :data="auditLogs" :loading="loadingAudit" />
        </n-tab-pane>
      </n-tabs>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  NTabs, NTabPane, NStatistic, NDataTable, NButton,
} from 'naive-ui'
import { ref, onMounted, h } from 'vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({ layout: 'admin' })
useHead({ title: '管理后台' })

const authStore = useAuthStore()
const router = useRouter()
const { api } = useApi()

const dashboard = ref<{ users: { total: number; paid: number }; searches: { today: number }; takedown: { pending: number } } | null>(null)
const users = ref<unknown[]>([])
const loadingUsers = ref(false)
const userPagination = ref({ page: 1, pageSize: 20, itemCount: 0 })

const auditLogs = ref<unknown[]>([])
const loadingAudit = ref(false)

const userColumns = [
  { title: 'ID', key: 'id' },
  { title: '用户名', key: 'username' },
  { title: '邮箱', key: 'email' },
  { title: '角色', key: 'role' },
  { title: '付费', key: 'isPaid', render: (row: { isPaid: boolean }) => row.isPaid ? '是' : '否' },
  { title: '状态', key: 'status' },
  { title: '注册时间', key: 'createdAt', render: (row: { createdAt: string }) => new Date(row.createdAt).toLocaleString() },
]

const auditColumns = [
  { title: '时间', key: 'createdAt', render: (row: { createdAt: string }) => new Date(row.createdAt).toLocaleString() },
  { title: '管理员', key: 'admin.username' },
  { title: '操作', key: 'action' },
  { title: '目标', key: 'targetType' },
]

onMounted(async () => {
  if (!authStore.isAdmin) {
    navigateTo('/')
    return
  }
  await Promise.all([loadDashboard(), loadUsers(), loadAuditLogs()])
})

async function loadDashboard() {
  try {
    dashboard.value = await api.get('/admin/dashboard')
  } catch {
    // ignore
  }
}

async function loadUsers() {
  loadingUsers.value = true
  try {
    const data = await api.get<{ list: unknown[]; total: number }>('/admin/users', {
      page: userPagination.value.page,
      pageSize: userPagination.value.pageSize,
    })
    users.value = data.list
    userPagination.value.itemCount = data.total
  } finally {
    loadingUsers.value = false
  }
}

async function loadAuditLogs() {
  loadingAudit.value = true
  try {
    const data = await api.get<{ list: unknown[] }>('/admin/audit-logs', { page: 1, pageSize: 50 })
    auditLogs.value = data.list
  } finally {
    loadingAudit.value = false
  }
}
</script>
