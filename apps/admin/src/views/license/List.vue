<script setup lang="ts">
import { ref, reactive, onMounted, h } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import {
  NCard, NDataTable, NButton, NSpace, NTag, NSelect, NPagination, NSpin, NEmpty,
  NModal, NForm, NFormItem, NInput, NInputNumber, NCode, type DataTableColumns,
} from 'naive-ui'
import { licenseApi, type License } from '@/api/license'

const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const list = ref<License[]>([])
const total = ref(0)
const query = reactive({
  page: 1,
  pageSize: 20,
  status: '' as string,
  tier: '' as string,
})

const statusOptions = [
  { label: '全部', value: '' },
  { label: '未使用', value: 'unused' },
  { label: '已使用', value: 'used' },
  { label: '已禁用', value: 'disabled' },
]

const tierOptions = [
  { label: '全部', value: '' },
  { label: '试用 (7天)', value: 'trial' },
  { label: '月卡 (30天)', value: 'monthly' },
  { label: '永久 (100年)', value: 'lifetime' },
]

const tierOptionsForGen = tierOptions.slice(1)

function statusTagType(status: License['status']) {
  return {
    unused: 'success',
    used: 'info',
    disabled: 'error',
  }[status] as 'success' | 'info' | 'error'
}

function statusLabel(status: License['status']) {
  return { unused: '未使用', used: '已使用', disabled: '已禁用' }[status]
}

function tierLabel(tier: License['tier']) {
  return { trial: '试用', monthly: '月卡', lifetime: '永久' }[tier]
}

const columns: DataTableColumns<License> = [
  { title: 'ID', key: 'id', width: 80 },
  {
    title: 'Code',
    key: 'code',
    width: 220,
    render: (row) => h(NCode, { code: row.code, language: 'text' }),
  },
  {
    title: '档位',
    key: 'tier',
    width: 100,
    render: (row) =>
      h(NTag, { type: 'info', size: 'small', round: true }, () => tierLabel(row.tier)),
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
  { title: '备注', key: 'note', ellipsis: { tooltip: true }, width: 180 },
  {
    title: '创建时间',
    key: 'createdAt',
    width: 160,
    render: (row) => new Date(row.createdAt).toLocaleString('zh-CN'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 100,
    render: (row) =>
      row.status === 'unused'
        ? h(
            NButton,
            { size: 'small', type: 'error', text: true, onClick: () => handleDisable(row) },
            () => '禁用',
          )
        : h('span', { style: 'color: #9ca3af;' }, '-'),
  },
]

async function loadList() {
  loading.value = true
  try {
    const res = await licenseApi.list({
      page: query.page,
      pageSize: query.pageSize,
      status: query.status || undefined,
      tier: query.tier || undefined,
    })
    list.value = res.list
    total.value = res.total
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

function handleDisable(row: License) {
  dialog.warning({
    title: '禁用 License',
    content: `确定禁用 ${row.code}？此操作不可逆。`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await licenseApi.disable(row.id)
        message.success('已禁用')
        await loadList()
      } catch (err) {
        message.error((err as Error).message)
      }
    },
  })
}

// Generate Modal
const showGenerate = ref(false)
const genForm = reactive({
  tier: 'monthly' as 'trial' | 'monthly' | 'lifetime',
  count: 1,
  note: '',
})
const generatedCodes = ref<License[]>([])

async function submitGenerate() {
  try {
    const res = await licenseApi.generate({
      tier: genForm.tier,
      count: genForm.count,
      note: genForm.note || undefined,
    })
    generatedCodes.value = res
    message.success(`生成 ${res.length} 个 license`)
    await loadList()
  } catch (err) {
    message.error((err as Error).message)
  }
}

function handleStatusChange(val: string) {
  query.status = val
  query.page = 1
  loadList()
}

function handleTierChange(val: string) {
  query.tier = val
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
  <NCard title="License 管理">
    <template #header-extra>
      <NSpace>
        <NSelect
          v-model:value="query.status"
          :options="statusOptions"
          style="width: 120px;"
          @update:value="handleStatusChange"
        />
        <NSelect
          v-model:value="query.tier"
          :options="tierOptions"
          style="width: 140px;"
          @update:value="handleTierChange"
        />
        <NButton type="primary" @click="showGenerate = true">生成 License</NButton>
        <NButton @click="loadList">刷新</NButton>
      </NSpace>
    </template>

    <NSpin :show="loading">
      <NDataTable
        :columns="columns"
        :data="list"
        :bordered="false"
        :row-key="(row: License) => row.id"
      />
      <NEmpty v-if="!loading && list.length === 0" description="暂无 License" />

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
      v-model:show="showGenerate"
      preset="card"
      title="生成 License Code"
      style="width: 520px;"
    >
      <NForm>
        <NFormItem label="档位">
          <NSelect v-model:value="genForm.tier" :options="tierOptionsForGen" />
        </NFormItem>
        <NFormItem label="数量">
          <NInputNumber v-model:value="genForm.count" :min="1" :max="100" />
        </NFormItem>
        <NFormItem label="备注">
          <NInput v-model:value="genForm.note" placeholder="如：WM 订单号 / 邀请码活动" />
        </NFormItem>
        <NSpace justify="end">
          <NButton @click="showGenerate = false">取消</NButton>
          <NButton type="primary" @click="submitGenerate">生成</NButton>
        </NSpace>
      </NForm>

      <div v-if="generatedCodes.length > 0" style="margin-top: 16px;">
        <h4>已生成（复制后分发）：</h4>
        <NCode
          :code="generatedCodes.map((c) => c.code).join('\n')"
          language="text"
          style="display: block; padding: 12px; background: #f9fafb;"
        />
      </div>
    </NModal>
  </NCard>
</template>
