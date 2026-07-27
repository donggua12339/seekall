<script setup lang="ts">
import { ref, computed, h, onMounted } from 'vue'
import {
  NCard,
  NGrid,
  NGridItem,
  NTag,
  NButton,
  NInput,
  NSpace,
  NSpin,
  NEmpty,
  NText,
  NBadge,
  useMessage,
} from 'naive-ui'
import { ruleApi, type Rule } from '@/api/rule'
import { getBulkWeeklyDownloads } from '@/api/npm'

const message = useMessage()
const loading = ref(true)
const rules = ref<Rule[]>([])
const search = ref('')
const riskFilter = ref<number | null>(null)
const downloads = ref<Record<string, number>>({})
const subscribedIds = ref<Set<string>>(new Set())
const subscribing = ref<string | null>(null)

const riskOptions = [
  { label: '全部', value: null },
  { label: 'L0 学术', value: 0 },
  { label: 'L1 开源', value: 1 },
  { label: 'L2 社区', value: 2 },
]

const riskColor = (level: number) => {
  const colors = ['#3aa675', '#2080f0', '#f0a020', '#f56c6c', '#909399']
  return colors[level] || '#909399'
}

const filteredRules = computed(() =>
  rules.value.filter((r) => {
    if (riskFilter.value !== null && r.riskLevel !== riskFilter.value) return false
    if (search.value) {
      const q = search.value.toLowerCase()
      return (
        r.npmPackage.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q)
      )
    }
    return true
  }),
)

async function loadRules() {
  loading.value = true
  try {
    const [marketRes, mySubs] = await Promise.all([
      ruleApi.list({ page: 1, pageSize: 100 }),
      ruleApi.mySubscriptions().catch(() => []),
    ])
    rules.value = marketRes.list
    subscribedIds.value = new Set(mySubs.map((r) => r.id))

    // 拉 npm 下载量
    const pkgs = marketRes.list.map((r) => r.npmPackage).filter(Boolean)
    if (pkgs.length > 0) {
      getBulkWeeklyDownloads(pkgs)
        .then((stats) => (downloads.value = stats))
        .catch(() => {})
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '加载失败')
  } finally {
    loading.value = false
  }
}

async function handleSubscribe(rule: Rule) {
  subscribing.value = rule.id
  try {
    if (subscribedIds.value.has(rule.id)) {
      await ruleApi.unsubscribe(rule.id)
      subscribedIds.value.delete(rule.id)
      message.success(`已取消订阅 ${rule.npmPackage}`)
    } else {
      await ruleApi.subscribe(rule.id)
      subscribedIds.value.add(rule.id)
      message.success(`已订阅 ${rule.npmPackage}`)
    }
  } catch (err) {
    message.error(err instanceof Error ? err.message : '操作失败')
  } finally {
    subscribing.value = null
  }
}

onMounted(loadRules)
</script>

<template>
  <div>
    <!-- 顶部搜索 + 筛选 -->
    <NCard style="margin-bottom: 16px">
      <NSpace align="center" :wrap="true">
        <NInput
          v-model:value="search"
          placeholder="搜索规则包名或描述..."
          clearable
          style="width: 320px"
        />
        <NButton
          v-for="opt in riskOptions"
          :key="String(opt.value)"
          :type="riskFilter === opt.value ? 'primary' : 'default'"
          :ghost="riskFilter !== opt.value"
          size="small"
          @click="riskFilter = opt.value"
        >
          {{ opt.label }}
        </NButton>
        <NText depth="3" style="margin-left: auto">
          共 {{ filteredRules.length }} / {{ rules.length }} 个规则
        </NText>
      </NSpace>
    </NCard>

    <!-- 规则网格 -->
    <NSpin :show="loading">
      <NEmpty v-if="!loading && filteredRules.length === 0" description="暂无匹配规则" />

      <NGrid v-else :cols="2" :x-gap="16" :y-gap="16" responsive="screen" :item-responsive="true">
        <NGridItem v-for="rule in filteredRules" :key="rule.id" span="2 m:1">
          <NCard hoverable style="height: 100%">
            <template #header>
              <NSpace align="center" :wrap="true">
                <NTag
                  :bordered="false"
                  size="small"
                  :style="{
                    background: riskColor(rule.riskLevel),
                    color: '#fff',
                  }"
                >
                  L{{ rule.riskLevel }}
                </NTag>
                <NText code strong style="font-size: 14px">
                  {{ rule.npmPackage }}
                </NText>
              </NSpace>
            </template>

            <NText depth="2" style="display: block; margin-bottom: 12px; min-height: 40px">
              {{ rule.description }}
            </NText>

            <NSpace justify="space-between" align="center">
              <NSpace :size="12">
                <NBadge
                  v-if="downloads[rule.npmPackage]"
                  :value="downloads[rule.npmPackage]"
                  :max="9999"
                  type="success"
                >
                  <NText depth="3" style="font-size: 12px">周下载</NText>
                </NBadge>
                <NTag
                  v-if="subscribedIds.has(rule.id)"
                  size="small"
                  type="success"
                  round
                >
                  已订阅
                </NTag>
              </NSpace>

              <NButton
                :type="subscribedIds.has(rule.id) ? 'default' : 'primary'"
                :ghost="subscribedIds.has(rule.id)"
                size="small"
                :loading="subscribing === rule.id"
                @click="handleSubscribe(rule)"
              >
                {{ subscribedIds.has(rule.id) ? '取消订阅' : '订阅' }}
              </NButton>
            </NSpace>
          </NCard>
        </NGridItem>
      </NGrid>
    </NSpin>
  </div>
</template>
