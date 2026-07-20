<script setup lang="ts">
import { h, computed, type VNodeChild } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NLayout,
  NLayoutSider,
  NLayoutHeader,
  NLayoutContent,
  NMenu,
  NButton,
  NSpace,
  NAvatar,
  NText,
  NTag,
  type MenuOption,
} from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import { useAppStore } from '@/stores/app'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const app = useAppStore()

function renderIcon(emoji: string) {
  return (): VNodeChild => h('span', { style: 'font-size: 16px;' }, emoji)
}

const menuOptions = computed<MenuOption[]>(() => [
  { label: '我的概览', key: 'dashboard', icon: renderIcon('📊') },
  { label: '我的规则', key: 'my-rules', icon: renderIcon('📋') },
  { label: '提交规则', key: 'rule-submit', icon: renderIcon('➕') },
  { label: '我的 License', key: 'my-licenses', icon: renderIcon('🔑') },
  { label: '我的订阅', key: 'my-subscriptions', icon: renderIcon('⭐') },
  { label: 'DMCA 举报', key: 'dmca-submit', icon: renderIcon('⚠️') },
  { label: '账号设置', key: 'settings', icon: renderIcon('⚙️') },
])

const activeKey = computed(() => {
  const name = route.name as string
  return name || 'dashboard'
})

function handleMenuSelect(key: string) {
  router.push({ name: key })
}

function handleLogout() {
  auth.logout()
  router.push('/login')
}

function handleToggleDark() {
  app.toggleDark()
}

const tierLabel = computed(() => {
  if (!auth.user) return ''
  if (auth.user.tier === 'trial') return '试用'
  if (auth.user.tier === 'monthly') return '月度会员'
  if (auth.user.tier === 'lifetime') return '终身会员'
  return '免费'
})

const tierType = computed<'default' | 'success' | 'warning'>(() => {
  if (auth.user?.isPaid) return 'success'
  if (auth.user?.tier === 'trial') return 'warning'
  return 'default'
})
</script>

<template>
  <NLayout has-sider style="height: 100vh">
    <NLayoutSider
      bordered
      :collapsed="app.collapsed"
      collapse-mode="width"
      :collapsed-width="64"
      :width="220"
      show-trigger
      @collapse="app.collapsed = true"
      @expand="app.collapsed = false"
    >
      <div class="logo-bar">
        <img src="/favicon.svg" width="28" height="28" />
        <span v-if="!app.collapsed" class="logo-text">SeekAll 用户中心</span>
      </div>
      <NMenu
        :collapsed="app.collapsed"
        :collapsed-width="64"
        :collapsed-icon-size="20"
        :options="menuOptions"
        :value="activeKey"
        @update:value="handleMenuSelect"
      />
    </NLayoutSider>
    <NLayout>
      <NLayoutHeader bordered class="header">
        <NSpace justify="space-between" align="center" style="height: 100%; padding: 0 20px;">
          <NText strong>{{ route.meta.title || '用户中心' }}</NText>
          <NSpace align="center">
            <NButton quaternary circle @click="handleToggleDark">
              <template #icon>
                <span>{{ app.darkMode ? '☀️' : '🌙' }}</span>
              </template>
            </NButton>
            <NTag v-if="auth.user" :type="tierType" size="small" round>
              {{ tierLabel }}
            </NTag>
            <NAvatar round size="small" style="background: #3aa675;">
              {{ auth.user?.username?.charAt(0).toUpperCase() || 'U' }}
            </NAvatar>
            <NText depth="2">{{ auth.user?.username }}</NText>
            <NButton size="small" quaternary type="error" @click="handleLogout">
              退出
            </NButton>
          </NSpace>
        </NSpace>
      </NLayoutHeader>
      <NLayoutContent class="content" content-style="padding: 20px;">
        <RouterView />
      </NLayoutContent>
    </NLayout>
  </NLayout>
</template>

<style scoped>
.logo-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border-bottom: 1px solid #e5e7eb;
  height: 56px;
}
.logo-text {
  font-weight: 600;
  color: #1f2937;
  font-size: 14px;
}
.header {
  height: 56px;
  background: #fff;
}
.content {
  background: #f5f5f5;
}
</style>
