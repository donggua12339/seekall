<template>
  <n-config-provider :theme="theme" :locale="zhCN" :date-locale="dateZhCN">
    <n-loading-bar-provider>
      <n-message-provider>
        <n-dialog-provider>
          <n-notification-provider>
            <div class="min-h-screen flex flex-col">
              <!-- 顶部导航 -->
              <AppHeader />

              <!-- 主体内容 -->
              <main class="flex-1">
                <slot />
              </main>

              <!-- 底部 -->
              <AppFooter />
            </div>
          </n-notification-provider>
        </n-dialog-provider>
      </n-message-provider>
    </n-loading-bar-provider>
  </n-config-provider>
</template>

<script setup lang="ts">
import {
  darkTheme,
  zhCN,
  dateZhCN,
  NConfigProvider,
  NLoadingBarProvider,
  NMessageProvider,
  NDialogProvider,
  NNotificationProvider,
} from 'naive-ui'
import { computed } from 'vue'

const colorMode = useColorMode()

const theme = computed(() => (colorMode.value === 'dark' ? darkTheme : null))
</script>
