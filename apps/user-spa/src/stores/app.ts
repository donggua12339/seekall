import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAppStore = defineStore('app', () => {
  const collapsed = ref(false)
  const darkMode = ref(localStorage.getItem('sa_user_dark') === 'true')

  function toggleCollapsed() {
    collapsed.value = !collapsed.value
  }

  function toggleDark() {
    darkMode.value = !darkMode.value
    localStorage.setItem('sa_user_dark', String(darkMode.value))
  }

  return {
    collapsed,
    darkMode,
    toggleCollapsed,
    toggleDark,
  }
})
