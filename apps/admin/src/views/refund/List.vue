<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import {
  NCard,
  NDataTable,
  NTag,
  NButton,
  NSpace,
  NSelect,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NDescriptions,
  NDescriptionsItem,
  NText,
  useMessage,
  useDialog,
  type DataTableColumns,
} from 'naive-ui'
import { adminApi, type RefundRequest } from '@/api/admin'

const message = useMessage()
const dialog = useDialog()
const loading = ref(true)
const refunds = ref<RefundRequest[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const statusFilter = ref<string | null>(null)

const statusOptions = [
  { label: '全部', value: 'all' },
  { label: '待审核', value: 'pending' },
  { label: '已批准', value: 'approved' },
  { label: '已拒绝', value: 'rejected' },
]

async function load() {
  loading.value = true
  try {
    const res = await adminApi.listRefunds({
      page: page.value,
      pageSize: pageSize.value,
      status: statusFilter.value || undefined,
    })
    refunds.value = res.list
    total.value = res.total
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    loading.value = false
  }
}

onMounted(load)

const statusTagType = (status?: string): 'default' | 'warning' | 'success' | 'error' => {
  if (status === 'approved') return 'success'
  if (status === 'rejected') return 'error'
  if (status === 'pending') return 'warning'
  return 'default'
}

// 审核 modal
const modalVisible = ref(false)
const modalAction = ref<'approve' | 'reject'>('approve')
const modalRefund = ref<RefundRequest | null>(null)
const modalNote = ref('')

function openModal(r: RefundRequest, action: 'approve' | 'reject') {
  modalRefund.value = r
  modalAction.value = action
  modalNote.value = ''
  modalVisible.value = true
}

async function handleReview() {
  if (!modalRefund.value) return
  try {
    if (modalAction.value === 'approve') {
      await adminApi.approveRefund(modalRefund.value.id, modalNote.value || undefined)
      message.success('退款已批准,license 已标记 disabled')
    } else {
      await adminApi.rejectRefund(modalRefund.value.id, modalNote.value || undefined)
      message.success('退款已拒绝')
    }
    modalVisible.value = false
    await load()
  } catch (err) {
    message.error(err instanceof Error ? err.message : '操作失败')
  }
}

const columns: DataTableColumns<RefundRequest> = [
  {
    title: 'ID',
    key: 'id',
    width: 80,
  },
  {
    title: 'License Code',
    key: 'licenseCode',
    width: 200,
    render: (row) => h('code', null, row.detail?.licenseCode || '-'),
  },
  {
    title: '档位',
    key: 'tier',
    width: 100,
    render: (row) => row.detail?.tier || '-',
  },
  {
    title: '退款原因',
    key: 'reason',
    ellipsis: { tooltip: true },
    render: (row) => row.detail?.reason || '-',
  },
  {
    title: '申请人',
    key: 'admin',
    width: 120,
    render: (row) => row.admin?.username || row.detail?.userId || '-',
  },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render: (row) =>
      h(NTag, { size: 'small', type: statusTagType(row.detail?.status) }, () =>
        row.detail?.status || 'pending',
      ),
  },
  {
    title: '申请时间',
    key: 'createdAt',
    width: 180,
    render: (row) => new Date(row.createdAt).toLocaleString('zh-CN'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    render: (row) =>
      row.detail?.status === 'pending'
        ? h(NSpace, () => [
            h(
              NButton,
              {
                size: 'small',
                type: 'success',
                onClick: () => openModal(row, 'approve'),
              },
              () => '批准',
            ),
            h(
              NButton,
              {
                size: 'small',
                type: 'error',
                onClick: () => openModal(row, 'reject'),
              },
              () => '拒绝',
            ),
          ])
        : h(NText, { depth: 3 }, () => '已处理'),
  },
]
</script>

<template>
  <NCard title="退款审核">
    <NSpace style="margin-bottom: 16px;">
      <NSelect
        v-model:value="statusFilter"
        :options="statusOptions"
        placeholder="状态筛选"
        clearable
        style="width: 160px;"
        @update:value="load"
      />
      <NButton @click="load">刷新</NButton>
    </NSpace>

    <NDataTable
      :columns="columns"
      :data="refunds"
      :loading="loading"
      :bordered="false"
      striped
      :pagination="{
        page,
        pageSize,
        itemCount: total,
        showSizePicker: false,
        onChange: (p: number) => { page = p; load() },
      }"
    />

    <NModal
      v-model:show="modalVisible"
      preset="dialog"
      :title="modalAction === 'approve' ? '批准退款' : '拒绝退款'"
      positive-text="确认"
      negative-text="取消"
      @positive-click="handleReview"
    >
      <NDescriptions v-if="modalRefund" bordered :column="1" label-placement="left" size="small">
        <NDescriptionsItem label="License Code">
          <NText code>{{ modalRefund.detail?.licenseCode }}</NText>
        </NDescriptionsItem>
        <NDescriptionsItem label="档位">
          {{ modalRefund.detail?.tier }}
        </NDescriptionsItem>
        <NDescriptionsItem label="退款原因">
          {{ modalRefund.detail?.reason }}
        </NDescriptionsItem>
      </NDescriptions>

      <NForm style="margin-top: 16px;">
        <NFormItem :label="modalAction === 'approve' ? '批准备注(可选)' : '拒绝原因(可选)'">
          <NInput
            v-model:value="modalNote"
            type="textarea"
            :placeholder="modalAction === 'approve' ? '如:已核对,同意退款' : '如:超过 7 天 / 已大量使用'"
            :autosize="{ minRows: 2, maxRows: 4 }"
          />
        </NFormItem>
      </NForm>

      <NText v-if="modalAction === 'approve'" type="warning" style="font-size: 13px;">
        批准后,该 license 将被标记为 disabled(已退款),用户无法继续使用。
      </NText>
    </NModal>
  </NCard>
</template>
