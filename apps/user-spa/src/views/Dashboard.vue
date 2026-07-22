<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  NCard,
  NGrid,
  NGridItem,
  NStatistic,
  NSpin,
  NTag,
  NButton,
  NSpace,
  NText,
} from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import type { UserInfo } from '@/api/auth'

const auth = useAuthStore()
const loading = ref(true)
const userInfo = ref<UserInfo | null>(null)

async function loadUserInfo() {
  loading.value = true
  try {
    // 刷新用户信息(从后端 /user/me 拿最新)
    userInfo.value = auth.user
  } finally {
    loading.value = false
  }
}

onMounted(loadUserInfo)

const tierLabel = (tier?: string | null) => {
  if (tier === 'trial') return '试用'
  if (tier === 'monthly') return '月度会员'
  if (tier === 'lifetime') return '终身会员'
  return '免费用户'
}

const badgeLabel = (badge: string): string => {
  const map: Record<string, string> = {
    contributor: '贡献者',
    reviewer: '评审员',
    early_adopter: '早期用户',
  }
  return map[badge] || badge
}

const badgeTagType = (badge: string): 'success' | 'warning' | 'info' => {
  if (badge === 'contributor') return 'success'
  if (badge === 'reviewer') return 'warning'
  return 'info'
}
</script>

<template>
  <NSpin :show="loading">
    <NGrid :cols="4" :x-gap="16" :y-gap="16">
      <NGridItem>
        <NCard>
          <NStatistic label="账号状态">
            <template #suffix>
              <NTag
                size="small"
                :type="userInfo?.status === 'active' ? 'success' : 'warning'"
                round
              >
                {{ userInfo?.status || 'unknown' }}
              </NTag>
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
      <NGridItem>
        <NCard>
          <NStatistic
            label="会员档位"
            :value="tierLabel(userInfo?.tier)"
          />
        </NCard>
      </NGridItem>
      <NGridItem>
        <NCard>
          <NStatistic
            label="付费状态"
            :value="userInfo?.isPaid ? '已付费' : '未付费'"
          >
            <template #suffix>
              <NTag
                size="small"
                :type="userInfo?.isPaid ? 'success' : 'default'"
                round
              >
                {{ userInfo?.isPaid ? 'paid' : 'free' }}
              </NTag>
            </template>
          </NStatistic>
        </NCard>
      </NGridItem>
      <NGridItem>
        <NCard>
          <NStatistic label="到期时间" :value="userInfo?.paidUntil?.slice(0, 10) || '永久'" />
        </NCard>
      </NGridItem>
    </NGrid>

    <NCard title="快速入口" style="margin-top: 16px;">
      <NSpace>
        <NButton type="primary" @click="$router.push('/rules/submit')">
          提交新规则
        </NButton>
        <NButton @click="$router.push('/licenses')">
          查看 License
        </NButton>
        <NButton @click="$router.push('/subscriptions')">
          我的订阅
        </NButton>
        <NButton
          v-if="userInfo?.isPaid"
          type="warning"
          @click="$router.push('/licenses')"
        >
          邀请好友(赚 ¥1 试用码)
        </NButton>
        <NButton @click="$router.push('/dmca')">
          DMCA 举报
        </NButton>
      </NSpace>
    </NCard>

    <NCard
      v-if="userInfo?.isPaid"
      title="邀请好友"
      style="margin-top: 16px;"
    >
      <NSpace vertical>
        <NText>
          月度/终身会员每月可生成 3 个 ¥1 试用邀请码,分享给朋友体验 SeekAll。
        </NText>
        <NText depth="3">
          朋友用邀请码激活后,可获得 7 天试用会员(L0-L1 规则订阅权限)。
        </NText>
        <NButton type="primary" @click="$router.push('/licenses')">
          生成邀请码
        </NButton>
      </NSpace>
    </NCard>

    <NCard title="账号信息" style="margin-top: 16px;">
      <NSpace vertical>
        <NText>
          <NText depth="3">用户名:</NText>
          {{ userInfo?.username }}
          <NTag
            v-if="userInfo?.badge"
            size="small"
            :type="badgeTagType(userInfo.badge)"
            round
            style="margin-left: 8px;"
          >
            {{ badgeLabel(userInfo.badge) }}
          </NTag>
        </NText>
        <NText>
          <NText depth="3">邮箱:</NText>
          {{ userInfo?.email }}
        </NText>
        <NText>
          <NText depth="3">注册时间:</NText>
          {{ userInfo?.createdAt ? new Date(userInfo.createdAt).toLocaleString('zh-CN') : '-' }}
        </NText>
      </NSpace>
    </NCard>
  </NSpin>
</template>
