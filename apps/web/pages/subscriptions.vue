<template>
  <div class="container mx-auto px-4 py-8 max-w-3xl">
    <div class="flex-between mb-6">
      <h1 class="text-2xl font-bold">关键词订阅</h1>
      <n-button size="small" @click="showCreate = true">+ 新增订阅</n-button>
    </div>

    <!-- 说明 -->
    <n-alert type="info" class="mb-4" :bordered="false">
      订阅关键词后，系统每 2 小时检查一次。发现新资源时，将通过邮件通知你。
    </n-alert>

    <!-- 订阅列表 -->
    <div v-if="loading" class="space-y-3">
      <n-card v-for="i in 3" :key="i">
        <n-skeleton text :repeat="2" />
      </n-card>
    </div>

    <div v-else-if="list.length > 0" class="space-y-3">
      <n-card v-for="sub in list" :key="sub.id" hoverable>
        <div class="flex-between">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-1">
              <span class="font-medium text-base truncate">{{ sub.keyword }}</span>
              <n-tag v-if="!sub.active" size="tiny" type="default">已停用</n-tag>
            </div>
            <div class="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-3 flex-wrap">
              <span v-if="sub.notifyEmail">邮件通知</span>
              <span v-else>不通知</span>
              <span v-if="sub.lastNotifiedAt">
                上次通知：{{ formatTime(sub.lastNotifiedAt) }}
              </span>
              <span v-else>尚未通知</span>
              <span>已知结果数：{{ sub.lastResultCount }}</span>
              <span>订阅于 {{ formatTime(sub.createdAt) }}</span>
            </div>
          </div>
          <div class="flex gap-2 shrink-0">
            <n-button size="small" tag="a" :href="`/search?q=${encodeURIComponent(sub.keyword)}`">
              搜索
            </n-button>
            <n-button size="small" quaternary type="error" @click="removeSub(sub)">
              取消订阅
            </n-button>
          </div>
        </div>
      </n-card>
    </div>

    <n-empty v-else description="还没有订阅任何关键词" class="py-16">
      <template #extra>
        <n-button type="primary" @click="showCreate = true">+ 新增订阅</n-button>
      </template>
    </n-empty>

    <!-- 新增订阅弹窗 -->
    <n-modal
      v-model:show="showCreate"
      preset="dialog"
      title="新增关键词订阅"
      positive-text="订阅"
      negative-text="取消"
      :positive-button-props="{ loading: creating }"
      @positive-click="doCreate"
    >
      <n-space vertical>
        <n-input
          v-model:value="newKeyword"
          placeholder="输入要订阅的关键词"
          maxlength="100"
          show-count
          @keyup.enter="doCreate"
        />
        <n-checkbox v-model:checked="notifyEmail">有新资源时通过邮件通知我</n-checkbox>
      </n-space>
    </n-modal>
  </div>
</template>

<script setup lang="ts">
import {
  NButton,
  NCard,
  NTag,
  NSkeleton,
  NEmpty,
  NAlert,
  NModal,
  NInput,
  NSpace,
  NCheckbox,
  useMessage,
} from 'naive-ui'
import { ref, onMounted } from 'vue'

interface Subscription {
  id: number
  keyword: string
  notifyEmail: boolean
  lastNotifiedAt: string | null
  lastResultCount: number
  active: boolean
  createdAt: string
}

const { api } = useApi()
const message = useMessage()

const list = ref<Subscription[]>([])
const loading = ref(false)
const showCreate = ref(false)
const newKeyword = ref('')
const notifyEmail = ref(true)
const creating = ref(false)

async function loadList() {
  loading.value = true
  try {
    list.value = await api.get<Subscription[]>('/subscriptions')
  } catch (err) {
    message.error((err as Error).message || '加载失败')
  } finally {
    loading.value = false
  }
}

async function doCreate() {
  if (!newKeyword.value.trim()) {
    message.warning('请输入关键词')
    return false
  }
  creating.value = true
  try {
    await api.post('/subscriptions', {
      keyword: newKeyword.value.trim(),
      notifyEmail: notifyEmail.value,
    })
    message.success('订阅成功')
    newKeyword.value = ''
    showCreate.value = false
    await loadList()
    return true
  } catch (err) {
    message.error((err as Error).message || '订阅失败')
    return false
  } finally {
    creating.value = false
  }
}

async function removeSub(sub: Subscription) {
  try {
    await api.delete(`/subscriptions/${sub.id}`)
    message.success('已取消订阅')
    await loadList()
  } catch (err) {
    message.error((err as Error).message || '操作失败')
  }
}

function formatTime(t: string | null): string {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

onMounted(loadList)
</script>
