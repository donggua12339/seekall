<template>
  <n-modal
    :show="show"
    preset="card"
    title="键盘快捷键"
    style="width: 480px;"
    @update:show="$emit('update:show', $event)"
  >
    <div class="space-y-3">
      <div
        v-for="group in shortcutGroups"
        :key="group.title"
        class="border-b border-gray-100 dark:border-gray-800 pb-3 last:border-0 last:pb-0"
      >
        <div class="text-xs text-gray-500 mb-2">{{ group.title }}</div>
        <div
          v-for="item in group.items"
          :key="item.key"
          class="flex-between py-1.5 text-sm"
        >
          <span>{{ item.desc }}</span>
          <kbd
            class="px-2 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded"
          >
            {{ item.key }}
          </kbd>
        </div>
      </div>
    </div>
  </n-modal>
</template>

<script setup lang="ts">
import { NModal } from 'naive-ui'

defineProps<{ show: boolean }>()
defineEmits<{ 'update:show': [boolean] }>()

const shortcutGroups = [
  {
    title: '全局',
    items: [
      { key: '?', desc: '打开此快捷键面板' },
      { key: 'g h', desc: '回到首页' },
      { key: 'g s', desc: '跳到搜索页' },
      { key: 'g f', desc: '我的收藏' },
      { key: 'g u', desc: '我的订阅' },
      { key: 'Esc', desc: '关闭弹窗' },
    ],
  },
  {
    title: '搜索页',
    items: [
      { key: '/', desc: '聚焦搜索框' },
      { key: 'Enter', desc: '执行搜索' },
      { key: '1', desc: '切换到实时搜索' },
      { key: '2', desc: '切换到模糊搜索' },
      { key: '3', desc: '切换到组合搜索' },
    ],
  },
]
</script>
