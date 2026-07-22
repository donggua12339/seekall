<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface Contributor {
  id: string
  username: string
  badge: 'contributor' | 'reviewer' | 'early_adopter' | null
  bio?: string | null
  joinedAt: string
  publishedCount: number
}

const loading = ref(true)
const error = ref('')
const contributors = ref<Contributor[]>([])

const top3 = computed(() => contributors.value.slice(0, 3))
const restList = computed(() => contributors.value.slice(3))

const badgeLabel = (badge: string | null): string => {
  if (!badge) return ''
  const map: Record<string, string> = {
    contributor: '贡献者',
    reviewer: '评审员',
    early_adopter: '早期用户',
  }
  return map[badge] || badge
}

const badgeColor = (badge: string | null): string => {
  if (badge === 'contributor') return '#3aa675'
  if (badge === 'reviewer') return '#f0a020'
  if (badge === 'early_adopter') return '#2080f0'
  return '#999'
}

const medal = (index: number): string => {
  return ['🥇', '🥈', '🥉'][index] || ''
}

async function loadContributors() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(
      'https://seekall.winmelon.cn/api/v1/rules/contributors/list',
    )
    const body = await res.json()
    if (body.code === 0) {
      contributors.value = body.data || []
    } else {
      error.value = body.message || '加载失败'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : '网络错误'
  } finally {
    loading.value = false
  }
}

onMounted(loadContributors)
</script>

<template>
  <div class="contributors">
    <div v-if="loading" class="loading">加载中...</div>

    <div v-else-if="error" class="error">
      ⚠️ {{ error }}
      <button @click="loadContributors" class="retry-btn">重试</button>
    </div>

    <div v-else-if="contributors.length === 0" class="empty">
      <p>暂无贡献者。成为第一个贡献者！</p>
      <a href="./contributor-invite" class="cta-btn">查看贡献者邀请计划</a>
    </div>

    <template v-else>
      <!-- Top 3 -->
      <div v-if="top3.length > 0" class="podium">
        <div
          v-for="(c, i) in top3"
          :key="c.id"
          class="podium-card"
          :class="`rank-${i + 1}`"
        >
          <div class="medal">{{ medal(i) }}</div>
          <div class="username">{{ c.username }}</div>
          <div v-if="c.badge" class="badge" :style="{ color: badgeColor(c.badge) }">
            {{ badgeLabel(c.badge) }}
          </div>
          <div class="count">{{ c.publishedCount }} 个规则</div>
          <div v-if="c.bio" class="bio">{{ c.bio }}</div>
          <div class="joined">加入于 {{ new Date(c.joinedAt).toLocaleDateString('zh-CN') }}</div>
        </div>
      </div>

      <!-- 4+ 名 -->
      <div v-if="restList.length > 0" class="rest-list">
        <div v-for="(c, i) in restList" :key="c.id" class="rest-row">
          <span class="rank-num">{{ i + 4 }}</span>
          <span class="username">{{ c.username }}</span>
          <span v-if="c.badge" class="badge" :style="{ color: badgeColor(c.badge) }">
            {{ badgeLabel(c.badge) }}
          </span>
          <span class="count">{{ c.publishedCount }} 个规则</span>
          <span v-if="c.bio" class="bio">{{ c.bio }}</span>
        </div>
      </div>

      <div class="stats">
        共 {{ contributors.length }} 位贡献者
      </div>
    </template>
  </div>
</template>

<style scoped>
.contributors {
  margin: 24px 0;
}

.loading,
.error,
.empty {
  text-align: center;
  padding: 40px;
  color: var(--vp-text-color-light, #666);
}

.empty p {
  margin-bottom: 16px;
}

.cta-btn {
  display: inline-block;
  padding: 8px 20px;
  background: #3aa675;
  color: white;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 600;
}

.retry-btn {
  margin-left: 8px;
  padding: 4px 12px;
  border: 1px solid #3aa675;
  border-radius: 4px;
  background: transparent;
  color: #3aa675;
  cursor: pointer;
}

.podium {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.podium-card {
  border: 1px solid var(--vp-border-color, #e2e8f0);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  transition: box-shadow 0.2s, transform 0.2s;
}

.podium-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.podium-card.rank-1 {
  border-color: #fbbf24;
  background: linear-gradient(180deg, #fffbeb 0%, transparent 100%);
}

.podium-card.rank-2 {
  border-color: #d1d5db;
}

.podium-card.rank-3 {
  border-color: #f59e0b;
}

.medal {
  font-size: 36px;
  margin-bottom: 8px;
}

.username {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 4px;
}

.badge {
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 8px;
}

.count {
  font-size: 14px;
  color: #3aa675;
  font-weight: 600;
  margin-bottom: 8px;
}

.bio {
  font-size: 12px;
  color: var(--vp-text-color-light, #999);
  margin-bottom: 8px;
  line-height: 1.4;
}

.joined {
  font-size: 11px;
  color: var(--vp-text-color-light, #aaa);
}

.rest-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rest-row {
  display: grid;
  grid-template-columns: 40px 1fr auto auto 2fr;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border: 1px solid var(--vp-border-color, #e2e8f0);
  border-radius: 8px;
}

.rank-num {
  font-weight: 700;
  color: var(--vp-text-color-light, #999);
  text-align: center;
}

.rest-row .username {
  font-size: 14px;
  font-weight: 600;
}

.rest-row .badge {
  font-size: 11px;
  margin: 0;
}

.rest-row .count {
  font-size: 12px;
  margin: 0;
}

.rest-row .bio {
  font-size: 12px;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stats {
  text-align: right;
  margin-top: 16px;
  font-size: 12px;
  color: var(--vp-text-color-light, #999);
}

@media (max-width: 640px) {
  .rest-row {
    grid-template-columns: 30px 1fr auto;
    gap: 8px;
  }
  .rest-row .bio,
  .rest-row .badge {
    display: none;
  }
}
</style>
