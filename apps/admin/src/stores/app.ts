import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const darkMode = ref(false)
  const collapsed = ref(false)

  function toggleDark() {
    darkMode.value = !darkMode.value
    localStorage.setItem('admin_dark', darkMode.value ? '1' : '0')
  }

  function toggleCollapsed() {
    collapsed.value = !collapsed.value
  }

  // 初始化从 localStorage 恢复
  const saved = localStorage.getItem('admin_dark')
  if (saved === '1') darkMode.value = true

  return { darkMode, collapsed, toggleDark, toggleCollapsed }
})
