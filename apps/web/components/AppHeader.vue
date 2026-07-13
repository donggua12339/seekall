<template>
  <header class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-50">
    <div class="container mx-auto px-4 py-3 flex-between">
      <div class="flex items-center gap-4">
        <NuxtLink to="/" class="text-xl font-bold text-indigo-600 dark:text-indigo-400">
          觅源 SeekAll
        </NuxtLink>
      </div>

      <nav class="flex items-center gap-2">
        <NuxtLink
          to="/search"
          class="px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
        >
          搜索
        </NuxtLink>
        <NuxtLink
          to="/favorites"
          class="px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
          v-if="authStore.isLoggedIn"
        >
          收藏
        </NuxtLink>
        <NuxtLink
          to="/profile"
          class="px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
          v-if="authStore.isLoggedIn"
        >
          个人主页
        </NuxtLink>
        <NuxtLink
          to="/admin"
          class="px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
          v-if="authStore.isAdmin"
        >
          后台
        </NuxtLink>

        <template v-if="!authStore.isLoggedIn">
          <NuxtLink to="/auth/login">
            <n-button size="small">登录</n-button>
          </NuxtLink>
          <NuxtLink to="/auth/register">
            <n-button size="small" type="primary">注册</n-button>
          </NuxtLink>
        </template>
        <template v-else>
          <n-button size="small" @click="authStore.logout()">退出</n-button>
        </template>
      </nav>
    </div>
  </header>
</template>

<script setup lang="ts">
import { NButton } from 'naive-ui'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
</script>
