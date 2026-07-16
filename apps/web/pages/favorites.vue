<template>
  <div class="container mx-auto px-4 py-8 max-w-4xl">
    <h1 class="text-2xl font-bold mb-6">我的收藏</h1>

    <div v-if="loading" class="space-y-3">
      <n-card v-for="i in 3" :key="i"><n-skeleton text :repeat="2" /></n-card>
    </div>

    <div v-else-if="result && result.list.length > 0" class="space-y-3">
      <n-card v-for="item in result.list" :key="String(item.id)" :title="item.title" hoverable>
        <template #header-extra>
          <n-tag size="small">{{ item.source }}</n-tag>
        </template>
        <div class="text-xs text-gray-400 truncate">{{ item.resourceUrl }}</div>
        <template #action>
          <n-button size="small" tag="a" :href="item.resourceUrl" target="_blank" type="primary">
            打开
          </n-button>
          <n-button size="small" @click="removeFavorite(item.id)">取消收藏</n-button>
        </template>
      </n-card>

      <div class="flex-center pt-4">
        <n-pagination v-model:page="page" :page-count="result.totalPages" @update:page="load" />
      </div>
    </div>

    <n-empty v-else description="还没有收藏" />
  </div>
</template>

<script setup lang="ts">
import { NCard, NTag, NButton, NPagination, NSkeleton, NEmpty, useMessage } from 'naive-ui'
import { ref, onMounted } from 'vue'

useHead({ title: '我的收藏' })

const { api } = useApi()
const message = useMessage()

const loading = ref(false)
const page = ref(1)
const result = ref<{
  list: { id: string; title: string; resourceUrl: string; source: string }[]
  totalPages: number
} | null>(null)

async function load() {
  if (!useAuthStore().isLoggedIn) {
    navigateTo('/auth/login')
    return
  }
  loading.value = true
  try {
    result.value = await api.get('/favorites', { page: page.value, pageSize: 20 })
  } catch (err) {
    message.error((err as Error).message)
  } finally {
    loading.value = false
  }
}

async function removeFavorite(id: string) {
  try {
    await api.delete(`/favorites/${id}`)
    message.success('已取消收藏')
    load()
  } catch (err) {
    message.error((err as Error).message)
  }
}

onMounted(load)
</script>
