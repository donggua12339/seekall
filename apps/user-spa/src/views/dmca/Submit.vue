<script setup lang="ts">
import { ref, reactive } from 'vue'
import {
  NCard,
  NForm,
  NFormItem,
  NInput,
  NButton,
  NSpace,
  NText,
  NSelect,
  NCheckbox,
  NAlert,
  NDivider,
  useMessage,
} from 'naive-ui'
import { dmcaApi } from '@/api/dmca'

const message = useMessage()
const loading = ref(false)

const form = reactive({
  infringingUrl: '',
  ruleId: undefined as number | undefined,
  originalTitle: '',
  copyrightOwner: '',
  reporterEmail: '',
  reporterRole: 'owner' as 'owner' | 'agent',
  goodFaithStatement: false,
  accuracyStatement: false,
  electronicSignature: '',
  notes: '',
})

const roleOptions = [
  { label: '版权所有者(owner)', value: 'owner' },
  { label: '授权代理(agent)', value: 'agent' },
]

async function handleSubmit() {
  if (!form.infringingUrl || !form.originalTitle || !form.copyrightOwner || !form.reporterEmail) {
    message.warning('请填写所有必填字段')
    return
  }
  if (!form.goodFaithStatement || !form.accuracyStatement) {
    message.warning('请勾选善意声明和准确性声明')
    return
  }
  if (!form.electronicSignature) {
    message.warning('请输入电子签名')
    return
  }

  loading.value = true
  try {
    const notice = await dmcaApi.submit(form)
    message.success(`举报已提交,编号: ${notice.id}`)
    // 重置表单
    Object.assign(form, {
      infringingUrl: '',
      ruleId: undefined,
      originalTitle: '',
      copyrightOwner: '',
      reporterEmail: '',
      reporterRole: 'owner',
      goodFaithStatement: false,
      accuracyStatement: false,
      electronicSignature: '',
      notes: '',
    })
  } catch (err) {
    message.error(err instanceof Error ? err.message : '提交失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <NCard title="DMCA 版权侵权举报">
    <NAlert type="warning" style="margin-bottom: 16px;" :bordered="false">
      <NText strong>DMCA §512(c) Takedown Notice</NText>
      <NText depth="3" style="display: block; margin-top: 4px;">
        提交虚假举报可能承担法律责任。请确认你有权代表版权所有者,且举报内容真实准确。
      </NText>
    </NAlert>

    <NForm label-placement="top">
      <NFormItem label="侵权 URL" required>
        <NInput
          v-model:value="form.infringingUrl"
          placeholder="https://seekall.winmelon.cn/rules/xxx 或侵权页面 URL"
        />
      </NFormItem>
      <NFormItem label="原作品标题" required>
        <NInput v-model:value="form.originalTitle" placeholder="被侵权的原作品名称" />
      </NFormItem>
      <NFormItem label="版权所有者" required>
        <NInput v-model:value="form.copyrightOwner" placeholder="版权所有者名称" />
      </NFormItem>
      <NFormItem label="举报人邮箱" required>
        <NInput v-model:value="form.reporterEmail" placeholder="your@email.com" />
      </NFormItem>
      <NFormItem label="举报人身份" required>
        <NSelect v-model:value="form.reporterRole" :options="roleOptions" />
      </NFormItem>
      <NFormItem label="备注(可选)">
        <NInput
          v-model:value="form.notes"
          type="textarea"
          placeholder="补充说明,如侵权证据、授权关系等"
          :autosize="{ minRows: 2, maxRows: 5 }"
        />
      </NFormItem>

      <NDivider />

      <NFormItem>
        <NSpace vertical>
          <NCheckbox v-model:checked="form.goodFaithStatement">
            <NText>我确认,出于善意相信该使用未获版权所有者或其代理人授权</NText>
          </NCheckbox>
          <NCheckbox v-model:checked="form.accuracyStatement">
            <NText>我确认,举报信息准确,且我是版权所有者或授权代理人(知悉伪证责任)</NText>
          </NCheckbox>
        </NSpace>
      </NFormItem>
      <NFormItem label="电子签名" required>
        <NInput
          v-model:value="form.electronicSignature"
          placeholder="输入你的全名作为电子签名"
        />
      </NFormItem>

      <NButton type="primary" :loading="loading" @click="handleSubmit">
        提交举报
      </NButton>
    </NForm>
  </NCard>
</template>
