<script setup lang="ts">
import { ref, reactive, onMounted, h } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import {
  NCard, NDataTable, NButton, NSpace, NTag, NSelect, NPagination, NSpin, NEmpty,
  NModal, NForm, NFormItem, NInput, type DataTableColumns,
} from 'naive-ui'
import { ruleApi, type Rule } from '@/api/rule'

const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const list = ref<Rule[]>([])
const total = ref(0)
const query = reactive({
  page: 1,
  pageSize: 20,
  riskLevel: undefined as number | undefined,
})

const riskOptions = [
  { label: '全部', value: undefined },
  { label: 'L0 - 公开学术', value: 0 },
  { label: 'L1 - 通用开源', value: 1 },
  { label: 'L2 - 社区评审', value: 2 },
  { label: 'L3 - 高风险', value: 3 },
  { label: 'L4 - 极高风险', value: 4 },
]

function riskTagType(level: Rule['riskLevel']) {
  return {
    l0: 'success',
    l1: 'success',
    l2: 'warning',
    l3: 'error',
    l4: 'error',
  }[level] as 'success' | 'warning' | 'error'
}

function statusTagType(status: Rule['status']) {
  return {
    pending_review: 'warning',
    published: 'success',
    taken_down: 'error',
    banned: 'error',
  }[status] as 'warning' | 'success' | 'error'
}

function statusLabel(status: Rule['status']) {
  return {
    pending_review: '评审中',
    published: '已发布',
    taken_down: '已下架',
    banned: '已封禁',
  }[status]
}

const columns: DataTableColumns<Rule> = [
  { title: 'ID', key: 'id', width: 80 },
  { title: 'npm 包名', key: 'npmPackage', ellipsis: { tooltip: true }, width: 200 },
  { title: '描述', key: 'description', ellipsis: { tooltip: true }, width: 240 },
  {
    title: '风险',
    key: 'riskLevel',
    width: 100,
    render: (row) =>
      h(NTag, { type: riskTagType(row.riskLevel), size: 'small', round: true }, () =>
        row.riskLevel.toUpperCase(),
      ),
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render: (row) =>
      h(NTag, { type: statusTagType(row.status), size: 'small', round: true }, () =>
        statusLabel(row.status),
      ),
  },
  { title: '下架次数', key: 'takedownCount', width: 90 },
  {
    title: '提交时间',
    key: 'createdAt',
    width: 160,
    render: (row) => new Date(row.createdAt).toLocaleString('zh-CN'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 280,
    render: (row) =>
      h(NSpace, { size: 'small' }, () => [
        row.status === 'pending_review' &&
          h(
            NButton,
            { size: 'small', type: 'success', onClick: () => handleFinalReview(row, true) },
            () => '通过',
          ),
        row.status === 'pending_review' &&
          h(
            NButton,
            { size: 'small', type: 'warning', onClick: () => handleFinalReview(row, false) },
            () => '拒绝',
          ),
        row.status === 'published' &&
          h(
            NButton,
            { size: 'small', type: 'error', onClick: () => handleTakedown(row) },
            () => '下架',
          ),
      ]),
  },
]

async function loadList() {
  loading.value = true
  try {
    const res = await ruleApi.list({
      page: query.page,
      pageSize: query.pageSize,
      riskLevel: query.riskLevel,
    })
    list.value = res.list
    total.value = res.total
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

// Takedown Modal
const showTakedown = ref(false)
const takedownForm = reactive({
  ruleId: '',
  npmPackage: '',
  reason: '',
})

function handleTakedown(row: Rule) {
  takedownForm.ruleId = row.id
  takedownForm.npmPackage = row.npmPackage
  takedownForm.reason = ''
  showTakedown.value = true
}

async function submitTakedown() {
  if (!takedownForm.reason) {
    message.warning('请填写下架理由')
    return
  }
  try {
    await ruleApi.takedown(takedownForm.ruleId, { reason: takedownForm.reason })
    message.success('下架成功')
    showTakedown.value = false
    await loadList()
  } catch (err) {
    message.error((err as Error).message)
  }
}

function handleFinalReview(row: Rule, approve: boolean) {
  dialog.warning({
    title: approve ? '终审通过' : '终审拒绝',
    content: `确定${approve ? '通过' : '拒绝'}规则 ${row.npmPackage}？`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await ruleApi.finalReview(row.id, { approve })
        message.success('操作成功')
        await loadList()
      } catch (err) {
        message.error((err as Error).message)
      }
    },
  })
}

function handleRiskChange(val: number | undefined) {
  query.riskLevel = val
  query.page = 1
  loadList()
}

function handlePageChange(p: number) {
  query.page = p
  loadList()
}

onMounted(loadList)
</script>

<template>
  <NCard title="规则评审管理">
    <template #header-extra>
      <NSpace>
        <NSelect
          v-model:value="query.riskLevel"
          :options="riskOptions"
          style="width: 160px;"
          @update:value="handleRiskChange"
        />
        <NButton @click="loadList">刷新</NButton>
      </NSpace>
    </template>

    <NSpin :show="loading">
      <NDataTable
        :columns="columns"
        :data="list"
        :bordered="false"
        :row-key="(row: Rule) => row.id"
      />
      <NEmpty v-if="!loading && list.length === 0" description="暂无规则" />

      <NSpace justify="end" style="margin-top: 16px;">
        <NPagination
          :page="query.page"
          :page-size="query.pageSize"
          :item-count="total"
          show-quick-jumper
          @update:page="handlePageChange"
        />
      </NSpace>
    </NSpin>

    <NModal
      v-model:show="showTakedown"
      preset="card"
      title="下架规则（DMCA Takedown）"
      style="width: 480px;"
    >
      <NForm>
        <NFormItem label="规则">
          <span>{{ takedownForm.npmPackage }}</span>
        </NFormItem>
        <NFormItem label="下架理由">
          <NInput
            v-model:value="takedownForm.reason"
            type="textarea"
            :rows="3"
            placeholder="如：收到版权方 DMCA 通知 #123"
          />
        </NFormItem>
        <NSpace justify="end">
          <NButton @click="showTakedown = false">取消</NButton>
          <NButton type="error" @click="submitTakedown">确认下架</NButton>
        </NSpace>
      </NForm>
    </NModal>
  </NCard>
</template>
