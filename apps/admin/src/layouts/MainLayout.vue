<script setup lang="ts">
import { h, computed, type VNodeChild } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NLayout, NLayoutSider, NLayoutHeader, NLayoutContent, NMenu,
  NButton, NSpace, NAvatar, NText, type MenuOption,
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
  { label: '数据概览', key: 'dashboard', icon: renderIcon('📊') },
  { label: 'DMCA 举报', key: 'dmca', icon: renderIcon('⚠️') },
  { label: '规则评审', key: 'rules', icon: renderIcon('📋') },
  { label: 'License 管理', key: 'licenses', icon: renderIcon('🔑') },
  { label: '用户管理', key: 'users', icon: renderIcon('👤') },
  { label: '审计日志', key: 'audit-logs', icon: renderIcon('📜') },
])

const activeKey = computed(() => {
  const name = route.name as string
  if (!name) return 'dashboard'
  if (name === 'dmca-detail') return 'dmca'
  if (name === 'rule-list') return 'rules'
  return name
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
        <span v-if="!app.collapsed" class="logo-text">SeekAll Admin</span>
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
          <NText strong>{{ route.meta.title || '管理后台' }}</NText>
          <NSpace align="center">
            <NButton quaternary circle @click="handleToggleDark">
              <template #icon>
                <span>{{ app.darkMode ? '☀️' : '🌙' }}</span>
              </template>
            </NButton>
            <NAvatar round size="small" style="background: #3aa675;">
              {{ auth.user?.username?.charAt(0).toUpperCase() || 'A' }}
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
