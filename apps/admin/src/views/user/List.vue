<script setup lang="ts">
import { ref, reactive, onMounted, h } from 'vue'
import { useMessage, useDialog } from 'naive-ui'
import {
  NCard, NDataTable, NButton, NSpace, NTag, NInput, NPagination, NSpin, NEmpty,
  NModal, NForm, NFormItem, type DataTableColumns,
} from 'naive-ui'
import { adminApi, type AdminUser } from '@/api/admin'

const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const list = ref<AdminUser[]>([])
const total = ref(0)
const query = reactive({
  page: 1,
  pageSize: 20,
  search: '',
})

function statusTagType(status: AdminUser['status']) {
  return {
    pending_verification: 'warning',
    active: 'success',
    banned: 'error',
    deleted: 'default',
  }[status] as 'warning' | 'success' | 'error' | 'default'
}

function statusLabel(status: AdminUser['status']) {
  return {
    pending_verification: '待验证',
    active: '正常',
    banned: '已封禁',
    deleted: '已删除',
  }[status]
}

const columns: DataTableColumns<AdminUser> = [
  { title: 'ID', key: 'id', width: 80 },
  { title: '用户名', key: 'username', width: 140 },
  { title: '邮箱', key: 'email', ellipsis: { tooltip: true }, width: 200 },
  {
    title: '角色',
    key: 'role',
    width: 100,
    render: (row) =>
      h(
        NTag,
        { type: row.role === 'super_admin' ? 'error' : 'default', size: 'small', round: true },
        () => (row.role === 'super_admin' ? '管理员' : '用户'),
      ),
  },
  {
    title: '会员',
    key: 'isPaid',
    width: 100,
    render: (row) =>
      h(
        NTag,
        { type: row.isPaid ? 'success' : 'default', size: 'small', round: true },
        () => (row.isPaid ? row.tier || '付费' : '免费'),
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
  {
    title: '注册时间',
    key: 'createdAt',
    width: 160,
    render: (row) => new Date(row.createdAt).toLocaleString('zh-CN'),
  },
  {
    title: '操作',
    key: 'actions',
    width: 120,
    render: (row) =>
      row.role !== 'super_admin'
        ? row.status === 'banned'
          ? h(
              NButton,
              { size: 'small', type: 'success', text: true, onClick: () => handleUnban(row) },
              () => '解封',
            )
          : h(
              NButton,
              { size: 'small', type: 'error', text: true, onClick: () => handleBan(row) },
              () => '封禁',
            )
        : h('span', { style: 'color: #9ca3af;' }, '-'),
  },
]

async function loadList() {
  loading.value = true
  try {
    const res = await adminApi.listUsers({
      page: query.page,
      pageSize: query.pageSize,
      search: query.search || undefined,
    })
    list.value = res.list
    total.value = res.total
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

const showBan = ref(false)
const banForm = reactive({ userId: '', username: '', reason: '' })

function handleBan(row: AdminUser) {
  banForm.userId = row.id
  banForm.username = row.username
  banForm.reason = ''
  showBan.value = true
}

async function submitBan() {
  if (!banForm.reason) {
    message.warning('请填写封禁理由')
    return
  }
  try {
    await adminApi.banUser(banForm.userId, banForm.reason)
    message.success('已封禁')
    showBan.value = false
    await loadList()
  } catch (err) {
    message.error((err as Error).message)
  }
}

function handleUnban(row: AdminUser) {
  dialog.warning({
    title: '解封用户',
    content: `确定解封 ${row.username}？`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        await adminApi.unbanUser(row.id)
        message.success('已解封')
        await loadList()
      } catch (err) {
        message.error((err as Error).message)
      }
    },
  })
}

function handleSearch() {
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
  <NCard title="用户管理">
    <template #header-extra>
      <NSpace>
        <NInput
          v-model:value="query.search"
          placeholder="搜索用户名/邮箱"
          style="width: 200px;"
          clearable
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        />
        <NButton @click="handleSearch">搜索</NButton>
        <NButton @click="loadList">刷新</NButton>
      </NSpace>
    </template>

    <NSpin :show="loading">
      <NDataTable
        :columns="columns"
        :data="list"
        :bordered="false"
        :row-key="(row: AdminUser) => row.id"
      />
      <NEmpty v-if="!loading && list.length === 0" description="暂无用户" />

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
      v-model:show="showBan"
      preset="card"
      title="封禁用户"
      style="width: 480px;"
    >
      <NForm>
        <NFormItem label="用户">
          <span>{{ banForm.username }}</span>
        </NFormItem>
        <NFormItem label="封禁理由">
          <NInput
            v-model:value="banForm.reason"
            type="textarea"
            :rows="3"
            placeholder="如：累计 3 次规则 takedown / 违反服务条款"
          />
        </NFormItem>
        <NSpace justify="end">
          <NButton @click="showBan = false">取消</NButton>
          <NButton type="error" @click="submitBan">确认封禁</NButton>
        </NSpace>
      </NForm>
    </NModal>
  </NCard>
</template>
