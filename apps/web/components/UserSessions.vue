<template>
  <n-card title="登录设备管理" class="mb-4">
    <template #header-extra>
      <n-button size="small" quaternary @click="loadSessions">刷新</n-button>
    </template>

    <n-empty v-if="!loading && !sessions.length" description="暂无登录设备记录" class="py-4" />

    <div v-else class="space-y-2">
      <div
        v-for="s in sessions"
        :key="s.id"
        class="session-item flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
      >
        <div class="flex items-center gap-3">
          <span class="text-2xl">📱</span>
          <div>
            <div class="font-medium text-sm">
              {{ formatUA(s.ua) }}
              <n-tag v-if="s.id === currentSessionId" size="tiny" type="success">当前设备</n-tag>
            </div>
            <div class="text-xs text-gray-500">
              IP: {{ s.ip }} · 登录时间: {{ formatTime(s.loginAt) }}
            </div>
          </div>
        </div>
        <n-button
          v-if="s.id !== currentSessionId"
          size="small"
          type="warning"
          quaternary
          :loading="revokingId === s.id"
          @click="revokeSession(s.id)"
        >
          踢出
        </n-button>
      </div>
    </div>
  </n-card>
</template>

<script setup lang="ts">
import { NCard, NButton, NTag, NEmpty, useMessage } from 'naive-ui'
import { ref, onMounted } from 'vue'

interface Session {
  id: string
  loginAt: string
  ip: string
  ua: string
}

const { api } = useApi()
const message = useMessage()

const loading = ref(false)
const sessions = ref<Session[]>([])
const revokingId = ref<string | null>(null)
const currentSessionId = ref<string>('')

function formatUA(ua: string): string {
  if (!ua || ua === 'unknown') return '未知设备'
  if (ua.includes('Mobile')) return '手机浏览器'
  if (ua.includes('PostmanRuntime')) return 'API 客户端'
  if (ua.includes('Chrome')) return 'Chrome 浏览器'
  if (ua.includes('Firefox')) return 'Firefox 浏览器'
  if (ua.includes('Safari')) return 'Safari 浏览器'
  return ua.slice(0, 50)
}

function formatTime(iso: string): string {
  if (!iso) return '未知'
  const d = new Date(iso)
  const diff = Date.now() - d.getTime()
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前'
  return d.toLocaleString()
}

async function loadSessions() {
  loading.value = true
  try {
    sessions.value = await api.get<Session[]>('/user/sessions')
  } catch {
    sessions.value = []
  } finally {
    loading.value = false
  }
}

async function revokeSession(id: string) {
  revokingId.value = id
  try {
    await api.delete(`/user/sessions/${id}`)
    message.success('已踢出该设备')
    await loadSessions()
  } catch (err) {
    message.error((err as Error).message || '操作失败')
  } finally {
    revokingId.value = null
  }
}

onMounted(loadSessions)
</script>

<style scoped>
.session-item {
  transition: background 0.2s;
}

.session-item:hover {
  background: rgba(99, 102, 241, 0.05);
}
</style>
