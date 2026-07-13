<template>
  <div class="container mx-auto px-4 py-8 max-w-3xl">
    <n-card title="用户协议">
      <div class="prose dark:prose-invert max-w-none">
        <pre class="whitespace-pre-wrap text-sm">{{ agreement?.content || '加载中...' }}</pre>
      </div>
    </n-card>
  </div>
</template>

<script setup lang="ts">
import { NCard } from 'naive-ui'
import { ref, onMounted } from 'vue'

useHead({ title: '用户协议' })

const { api } = useApi()
const agreement = ref<{ version: string; content: string } | null>(null)

onMounted(async () => {
  try {
    agreement.value = await api.get('/agreements/current')
  } catch {
    // ignore
  }
})
</script>
