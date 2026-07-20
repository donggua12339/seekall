<script setup lang="ts">
import { ref, reactive, onMounted, h } from 'vue'
import {
  NCard,
  NForm,
  NFormItem,
  NInput,
  NButton,
  NSpace,
  NText,
  NList,
  NListItem,
  NThing,
  NTime,
  NTag,
  NPopconfirm,
  NGrid,
  NGridItem,
  NStatistic,
  useMessage,
  useDialog,
} from 'naive-ui'
import { userApi, type Session } from '@/api/user'
import { useAuthStore } from '@/stores/auth'

const message = useMessage()
const dialog = useDialog()
const auth = useAuthStore()

const profileLoading = ref(true)
const profile = reactive({
  username: '',
  email: '',
  avatarUrl: '',
  bio: '',
})

const sessions = ref<Session[]>([])
const sessionLoading = ref(true)

const saveLoading = ref(false)

async function loadProfile() {
  profileLoading.value = true
  try {
    const p = await userApi.profile()
    profile.username = p.username
    profile.email = p.email
    profile.avatarUrl = p.avatarUrl || ''
    profile.bio = p.bio || ''
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    profileLoading.value = false
  }
}

async function loadSessions() {
  sessionLoading.value = true
  try {
    sessions.value = await userApi.sessions()
  } catch {
    // 静默
  } finally {
    sessionLoading.value = false
  }
}

async function handleSaveProfile() {
  saveLoading.value = true
  try {
    await userApi.updateProfile({
      avatarUrl: profile.avatarUrl || undefined,
      bio: profile.bio || undefined,
    })
    message.success('已保存')
  } catch (err) {
    message.error(err instanceof Error ? err.message : '保存失败')
  } finally {
    saveLoading.value = false
  }
}

async function handleDeleteSession(id: string) {
  try {
    await userApi.deleteSession(id)
    sessions.value = sessions.value.filter((s) => s.id !== id)
    message.success('已撤销会话')
  } catch (err) {
    message.error(err instanceof Error ? err.message : '撤销失败')
  }
}

function handleDeleteAccount() {
  dialog.warning({
    title: '删除账号',
    content: '此操作不可逆!所有数据将被永久删除(license / 订阅 / 规则提交历史)。确认删除?',
    positiveText: '确认删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await userApi.deleteAccount()
        message.success('账号已删除')
        auth.logout()
        window.location.href = '/'
      } catch (err) {
        message.error(err instanceof Error ? err.message : '删除失败')
      }
    },
  })
}

onMounted(() => {
  loadProfile()
  loadSessions()
})
</script>

<template>
  <NGrid :cols="2" :x-gap="16" :y-gap="16">
    <NGridItem>
      <NCard title="个人资料">
        <NForm label-placement="top">
          <NFormItem label="用户名">
            <NInput :value="profile.username" disabled />
          </NFormItem>
          <NFormItem label="邮箱">
            <NInput :value="profile.email" disabled />
          </NFormItem>
          <NFormItem label="头像 URL">
            <NInput v-model:value="profile.avatarUrl" placeholder="https://..." />
          </NFormItem>
          <NFormItem label="个人简介">
            <NInput
              v-model:value="profile.bio"
              type="textarea"
              placeholder="一句话介绍自己"
              :autosize="{ minRows: 2, maxRows: 4 }"
            />
          </NFormItem>
          <NButton type="primary" :loading="saveLoading" @click="handleSaveProfile">
            保存
          </NButton>
        </NForm>
      </NCard>
    </NGridItem>

    <NGridItem>
      <NCard title="登录会话">
        <NList bordered>
          <NListItem v-for="s in sessions" :key="s.id">
            <NThing>
              <template #header>
                <NText>{{ s.userAgent || 'Unknown device' }}</NText>
                <NTag v-if="s.ip" size="small" style="margin-left: 8px;">{{ s.ip }}</NTag>
              </template>
              <template #description>
                <NTime :time="new Date(s.lastUsedAt)" type="datetime" />
                <span style="margin-left: 8px;">最后使用</span>
              </template>
              <template #action>
                <NPopconfirm @positive-click="handleDeleteSession(s.id)">
                  <template #trigger>
                    <NButton size="small" type="error" quaternary>撤销</NButton>
                  </template>
                  确认撤销此会话?
                </NPopconfirm>
              </template>
            </NThing>
          </NListItem>
        </NList>

        <NCard title="危险操作" style="margin-top: 16px;" size="small">
          <NButton type="error" block @click="handleDeleteAccount">
            删除账号
          </NButton>
          <NText depth="3" style="font-size: 12px; margin-top: 8px; display: block;">
            删除后所有数据不可恢复
          </NText>
        </NCard>
      </NCard>
    </NGridItem>
  </NGrid>
</template>
