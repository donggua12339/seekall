<template>
  <header
    class="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-50"
  >
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

        <!-- auth 相关元素用 ClientOnly 包裹，避免 SSR/CSR hydration mismatch -->
        <ClientOnly>
          <NuxtLink
            v-if="authStore.isLoggedIn"
            to="/favorites"
            class="px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
          >
            收藏
          </NuxtLink>
          <NuxtLink
            v-if="authStore.isLoggedIn"
            to="/subscriptions"
            class="px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
          >
            订阅
          </NuxtLink>
          <NuxtLink
            v-if="authStore.isLoggedIn"
            to="/profile"
            class="px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
          >
            个人主页
          </NuxtLink>
          <NuxtLink
            v-if="authStore.isAdmin"
            to="/admin"
            class="px-3 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-sm"
          >
            后台
          </NuxtLink>
        </ClientOnly>

        <!-- 主题切换 -->
        <n-button size="small" quaternary @click="toggleTheme" :title="themeToggleTitle">
          {{ colorMode.preference === 'dark' ? '☀' : '☾' }}
        </n-button>

        <!-- 快捷键帮助 -->
        <n-button size="small" quaternary @click="showShortcut = true" title="快捷键 (?)">
          ?
        </n-button>

        <ClientOnly>
          <template v-if="!authStore.isLoggedIn">
            <NuxtLink to="/auth/login">
              <n-button size="small">登录</n-button>
            </NuxtLink>
            <NuxtLink to="/auth/register">
              <n-button size="small" type="primary">注册</n-button>
            </NuxtLink>
          </template>
          <template v-else>
            <n-button size="small" @click="handleLogout">退出</n-button>
          </template>
          <!-- SSR 占位，避免布局抖动 -->
          <template #fallback>
            <NuxtLink to="/auth/login">
              <n-button size="small">登录</n-button>
            </NuxtLink>
          </template>
        </ClientOnly>
      </nav>
    </div>

    <ShortcutHelp v-model:show="showShortcut" />
  </header>
</template>

<script setup lang="ts">
import { NButton } from 'naive-ui'
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useAuthStore } from '~/stores/auth'

const authStore = useAuthStore()
const colorMode = useColorMode()
const showShortcut = ref(false)

const themeToggleTitle = computed(() =>
  colorMode.preference === 'dark' ? '切换到亮色' : '切换到暗色',
)

function toggleTheme() {
  colorMode.preference = colorMode.preference === 'dark' ? 'light' : 'dark'
}

function handleLogout() {
  authStore.logout()
  navigateTo('/')
}

// g-prefix 导航快捷键
let gPressed = false
let gTimer: ReturnType<typeof setTimeout> | null = null

function handleKeydown(e: KeyboardEvent) {
  // 在输入框内不触发
  const tag = (document.activeElement?.tagName || '').toLowerCase()
  const inInput = tag === 'input' || tag === 'textarea'

  if (e.key === '?' && !inInput) {
    e.preventDefault()
    showShortcut.value = true
    return
  }

  if (e.key === 'Escape' && showShortcut.value) {
    showShortcut.value = false
    return
  }

  if (inInput) return

  if (e.key === 'g') {
    gPressed = true
    if (gTimer) clearTimeout(gTimer)
    gTimer = setTimeout(() => {
      gPressed = false
    }, 700)
    return
  }

  if (gPressed) {
    const map: Record<string, string> = {
      h: '/',
      s: '/search',
      f: '/favorites',
      u: '/subscriptions',
    }
    const target = map[e.key]
    if (target) {
      e.preventDefault()
      navigateTo(target)
    }
    gPressed = false
    if (gTimer) clearTimeout(gTimer)
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>
