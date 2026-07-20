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
  NTag,
  NStatistic,
  NGrid,
  NGridItem,
  NList,
  NListItem,
  NThing,
  NTime,
  useMessage,
} from 'naive-ui'
import { licenseApi, type InviteTrialCode } from '@/api/license'
import { useAuthStore } from '@/stores/auth'

const message = useMessage()
const auth = useAuthStore()

const redeemLoading = ref(false)
const redeemCode = ref('')

const inviteTrials = ref<InviteTrialCode[]>([])
const inviteUsedThisMonth = ref(0)
const inviteLimit = ref(3)
const inviteLoading = ref(false)

async function handleRedeem() {
  if (!redeemCode.value) {
    message.warning('请输入 license code')
    return
  }
  redeemLoading.value = true
  try {
    const res = await licenseApi.redeem(redeemCode.value)
    message.success(`激活成功!会员档位: ${res.user.tier}`)
    redeemCode.value = ''
    // 刷新用户信息
    if (auth.user) {
      auth.setUser({
        ...auth.user,
        isPaid: res.user.isPaid,
        tier: res.user.tier as 'trial' | 'monthly' | 'lifetime' | undefined,
      })
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '激活失败')
  } finally {
    redeemLoading.value = false
  }
}

async function loadInviteTrials() {
  try {
    const res = await licenseApi.myInviteTrials()
    inviteTrials.value = res.codes
    inviteUsedThisMonth.value = res.usedThisMonth
    inviteLimit.value = res.limit
  } catch (err) {
    // 未登录或非付费会员会失败,静默
  }
}

async function handleGenerateInvite() {
  inviteLoading.value = true
  try {
    const code = await licenseApi.generateInviteTrial()
    inviteTrials.value.unshift(code)
    inviteUsedThisMonth.value++
    message.success(`生成成功: ${code.code}`)
  } catch (err) {
    message.error(err instanceof Error ? err.message : '生成失败')
  } finally {
    inviteLoading.value = false
  }
}

onMounted(loadInviteTrials)

const canGenerateInvite = () => {
  return auth.user?.isPaid && inviteUsedThisMonth.value < inviteLimit.value
}

const statusTagType = (status: string): 'default' | 'success' | 'warning' | 'error' => {
  if (status === 'unused') return 'success'
  if (status === 'used') return 'default'
  if (status === 'disabled') return 'error'
  return 'default'
}
</script>

<template>
  <NGrid :cols="2" :x-gap="16" :y-gap="16">
    <NGridItem>
      <NCard title="激活 License Code">
        <NForm @submit.prevent="handleRedeem">
          <NFormItem label="License Code">
            <NInput
              v-model:value="redeemCode"
              placeholder="SA-TRY-xxxx 或 SA-MON-xxxx 或 SA-LIF-xxxx"
            />
          </NFormItem>
          <NButton type="primary" :loading="redeemLoading" @click="handleRedeem">
            激活
          </NButton>
        </NForm>
        <NText depth="3" style="font-size: 13px; margin-top: 12px; display: block;">
          License code 从 WM 发卡网购买后获得,格式 SA-{TIER|MON|LIF}-xxxx
        </NText>
      </NCard>
    </NGridItem>

    <NGridItem>
      <NCard title="邀请码生成">
        <NGrid :cols="2" :x-gap="12">
          <NGridItem>
            <NStatistic label="本月已生成" :value="`${inviteUsedThisMonth}/${inviteLimit}`" />
          </NGridItem>
          <NGridItem>
            <NButton
              type="primary"
              :disabled="!canGenerateInvite()"
              :loading="inviteLoading"
              @click="handleGenerateInvite"
            >
              生成邀请码
            </NButton>
          </NGridItem>
        </NGrid>
        <NText depth="3" style="font-size: 13px; margin-top: 8px; display: block;">
          月度/终身会员每月可生成 3 个 ¥1 试用邀请码
        </NText>

        <NList v-if="inviteTrials.length > 0" bordered style="margin-top: 16px;">
          <NListItem v-for="code in inviteTrials" :key="code.id">
            <NThing>
              <template #header>
                <NText code>{{ code.code }}</NText>
                <NTag
                  size="small"
                  :type="statusTagType(code.status)"
                  style="margin-left: 8px;"
                >
                  {{ code.status }}
                </NTag>
              </template>
              <template #description>
                <NTime :time="new Date(code.createdAt)" type="datetime" />
                <span v-if="code.usedBy" style="margin-left: 8px;">
                  被使用: {{ code.usedBy.username }}
                </span>
              </template>
            </NThing>
          </NListItem>
        </NList>
        <NText v-else depth="3" style="margin-top: 16px; display: block;">
          暂无邀请码
        </NText>
      </NCard>
    </NGridItem>
  </NGrid>
</template>
