<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useMessage, useDialog } from 'naive-ui'
import {
  NCard, NSpace, NButton, NTag, NSpin, NDescriptions, NDescriptionsItem,
  NInput, NRadioGroup, NRadio, NForm, NFormItem, NAlert,
} from 'naive-ui'
import { dmcaApi, type DmcaNotice } from '@/api/dmca'

const route = useRoute()
const router = useRouter()
const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const submitting = ref(false)
const notice = ref<DmcaNotice | null>(null)

const form = reactive({
  action: 'verify' as 'verify' | 'action' | 'reject',
  note: '',
})

const id = computed(() => route.params.id as string)
const isHandled = computed(() => notice.value?.status !== 'pending')

function statusTagType(status: DmcaNotice['status']) {
  return {
    pending: 'warning',
    verified: 'info',
    actioned: 'error',
    rejected: 'default',
  }[status] as 'warning' | 'info' | 'error' | 'default'
}

function statusLabel(status: DmcaNotice['status']) {
  return {
    pending: '待处理',
    verified: '已验证',
    actioned: '已下架',
    rejected: '已拒绝',
  }[status]
}

async function loadDetail() {
  loading.value = true
  try {
    notice.value = await dmcaApi.get(id.value)
  } catch (err) {
    message.error((err as Error).message)
    router.push('/dmca')
  } finally {
    loading.value = false
  }
}

function handleSubmit() {
  if (form.action === 'reject' && !form.note) {
    message.warning('拒绝时必须填写理由')
    return
  }
  dialog.warning({
    title: '确认操作',
    content: `确定执行「${{ verify: '验证', action: '下架', reject: '拒绝' }[form.action]}」？`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      submitting.value = true
      try {
        await dmcaApi.handle(id.value, { action: form.action, note: form.note })
        message.success('处理成功')
        await loadDetail()
      } catch (err) {
        message.error((err as Error).message)
      } finally {
        submitting.value = false
      }
    },
  })
}

onMounted(loadDetail)
</script>

<template>
  <NSpin :show="loading">
    <NSpace vertical :size="16">
      <NCard>
        <NSpace justify="space-between" align="center">
          <NSpace align="center">
            <h2 style="margin: 0;">DMCA 举报 #{{ id }}</h2>
            <NTag v-if="notice" :type="statusTagType(notice.status)" round size="medium">
              {{ statusLabel(notice.status) }}
            </NTag>
          </NSpace>
          <NButton @click="router.push('/dmca')">返回列表</NButton>
        </NSpace>
      </NCard>

      <NCard title="举报信息">
        <NDescriptions :column="2" bordered label-placement="left">
          <NDescriptionsItem label="侵权 URL">
            <a v-if="notice" :href="notice.infringingUrl" target="_blank" style="color: #3aa675;">
              {{ notice.infringingUrl }}
            </a>
          </NDescriptionsItem>
          <NDescriptionsItem label="关联规则">
            <span v-if="notice?.rule">
              #{{ notice.rule.id }} {{ notice.rule.npmPackage }}
            </span>
            <span v-else style="color: #9ca3af;">未关联</span>
          </NDescriptionsItem>
          <NDescriptionsItem label="原作品标题">
            {{ notice?.originalTitle }}
          </NDescriptionsItem>
          <NDescriptionsItem label="版权所有者">
            {{ notice?.copyrightOwner }}
          </NDescriptionsItem>
          <NDescriptionsItem label="举报人邮箱">
            {{ notice?.reporterEmail }}
          </NDescriptionsItem>
          <NDescriptionsItem label="举报人身份">
            {{ notice?.reporterRole === 'owner' ? '版权所有者' : '授权代表' }}
          </NDescriptionsItem>
          <NDescriptionsItem label="电子签名">
            {{ notice?.electronicSignature }}
          </NDescriptionsItem>
          <NDescriptionsItem label="提交时间">
            {{ notice ? new Date(notice.createdAt).toLocaleString('zh-CN') : '' }}
          </NDescriptionsItem>
          <NDescriptionsItem label="法定声明" :span="2">
            <NSpace>
              <NTag :type="notice?.goodFaithStatement ? 'success' : 'error'" size="small">
                善意声明 {{ notice?.goodFaithStatement ? '✓' : '✗' }}
              </NTag>
              <NTag :type="notice?.accuracyStatement ? 'success' : 'error'" size="small">
                准确性声明 {{ notice?.accuracyStatement ? '✓' : '✗' }}
              </NTag>
            </NSpace>
          </NDescriptionsItem>
          <NDescriptionsItem v-if="notice?.notes" label="额外说明" :span="2">
            {{ notice.notes }}
          </NDescriptionsItem>
        </NDescriptions>
      </NCard>

      <NCard v-if="notice && notice.status !== 'pending'" title="处理记录">
        <NDescriptions :column="2" bordered label-placement="left">
          <NDescriptionsItem label="处理人">
            {{ notice.handlerAdmin?.username || '-' }}
          </NDescriptionsItem>
          <NDescriptionsItem label="处理时间">
            {{ notice.handledAt ? new Date(notice.handledAt).toLocaleString('zh-CN') : '-' }}
          </NDescriptionsItem>
          <NDescriptionsItem label="处理备注" :span="2">
            {{ notice.handlerNote || '-' }}
          </NDescriptionsItem>
        </NDescriptions>
      </NCard>

      <NCard v-if="!isHandled" title="处理操作">
        <NAlert type="info" style="margin-bottom: 16px;">
          <strong>verify</strong>: 核实后标记为已验证（准备下架）<br />
          <strong>action</strong>: 执行下架（关联 Rule.takedown）<br />
          <strong>reject</strong>: 拒绝（误报，必须填理由）
        </NAlert>

        <NForm>
          <NFormItem label="处理动作">
            <NRadioGroup v-model:value="form.action">
              <NRadio value="verify">验证</NRadio>
              <NRadio value="action">下架</NRadio>
              <NRadio value="reject">拒绝</NRadio>
            </NRadioGroup>
          </NFormItem>
          <NFormItem label="处理备注">
            <NInput
              v-model:value="form.note"
              type="textarea"
              :rows="3"
              :placeholder="form.action === 'reject' ? '必须填写拒绝理由' : '处理备注（可选）'"
            />
          </NFormItem>
          <NSpace>
            <NButton
              type="primary"
              :loading="submitting"
              @click="handleSubmit"
            >
              提交处理
            </NButton>
          </NSpace>
        </NForm>
      </NCard>
    </NSpace>
  </NSpin>
</template>
