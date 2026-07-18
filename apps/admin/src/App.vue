<script setup lang="ts">
import { NConfigProvider, NMessageProvider, NDialogProvider, NLoadingBarProvider, zhCN, dateZhCN, darkTheme } from 'naive-ui'
import { computed } from 'vue'
import { useAppStore } from './stores/app'

const appStore = useAppStore()
const theme = computed(() => (appStore.darkMode ? darkTheme : null))
</script>

<template>
  <NConfigProvider :theme="theme" :locale="zhCN" :date-locale="dateZhCN">
    <NLoadingBarProvider>
      <NMessageProvider>
        <NDialogProvider>
          <RouterView />
        </NDialogProvider>
      </NMessageProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>
