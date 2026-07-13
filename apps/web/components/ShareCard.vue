<template>
  <div class="share-card-container">
    <div ref="cardRef" class="share-card" :class="{ dark: isDark }">
      <!-- 背景渐变 -->
      <div class="card-bg"></div>

      <!-- 内容 -->
      <div class="card-content">
        <!-- 标题 -->
        <h2 class="card-title">{{ resource.title }}</h2>

        <!-- 标签 -->
        <div class="card-tags">
          <span class="tag tag-source">{{ resource.sourceDisplayName }}</span>
          <span v-if="resource.fileType" class="tag tag-type">{{ resource.fileType }}</span>
        </div>

        <!-- 提取码 -->
        <div v-if="password" class="card-password">
          提取码：<strong>{{ password }}</strong>
        </div>

        <!-- 二维码 + 域名 -->
        <div class="card-footer">
          <div class="qrcode">
            <canvas ref="qrCanvas"></canvas>
          </div>
          <div class="card-brand">
            <div class="brand-name">觅源 SeekAll</div>
            <div class="brand-url">seekall.winmelon.cn</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作 -->
    <div class="card-actions">
      <n-button @click="downloadCard">下载图片</n-button>
      <n-button @click="copyCard" secondary>复制到剪贴板</n-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NButton, useMessage } from 'naive-ui'
import { ref, onMounted, watch } from 'vue'

interface Resource {
  title: string
  url: string
  source: string
  sourceDisplayName: string
  category: string
  fileSize?: number
  fileType?: string
}

const props = defineProps<{
  resource: Resource
  password: string | null
}>()

const message = useMessage()
const cardRef = ref<HTMLElement | null>(null)
const qrCanvas = ref<HTMLCanvasElement | null>(null)
const isDark = ref(false)

// 检测暗黑模式
if (typeof window !== 'undefined') {
  isDark.value = document.documentElement.classList.contains('dark')
}

onMounted(() => {
  drawQrCode()
})

watch(() => props.resource, () => {
  drawQrCode()
})

// 简易二维码生成（用 canvas 画一个简化版 QR 风格图案）
// 真正的 QR 需要库，这里用简化方块矩阵代替
function drawQrCode() {
  const canvas = qrCanvas.value
  if (!canvas) return
  const size = 100
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // 白色背景
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, size, size)

  // 简化 QR 图案：基于 URL 生成伪随机方块
  const url = props.resource.url
  const cellSize = 5
  const grid = size / cellSize

  ctx.fillStyle = '#000000'
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      // 三个定位角
      const isCorner =
        (x < 3 && y < 3) ||
        (x >= grid - 3 && y < 3) ||
        (x < 3 && y >= grid - 3)
      if (isCorner) {
        if (x === 0 || x === 2 || y === 0 || y === 2 || (x === 1 && y === 1)) {
          ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
        }
        continue
      }
      // 基于 URL hash 的伪随机
      const hash = (url.charCodeAt((x * 7 + y * 13) % url.length) + x * y) % 3
      if (hash === 0) {
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize)
      }
    }
  }
}

async function downloadCard() {
  // 用 html2canvas 或截图 API 生成图片
  // 这里简化为提示用户截图
  message.info('请右键卡片 → 另存为图片，或用截图工具保存')
}

async function copyCard() {
  try {
    // 复制资源信息到剪贴板
    const text = `${props.resource.title}\n来源：${props.resource.sourceDisplayName}\n链接：${props.resource.url}\n${props.password ? '提取码：' + props.password : ''}\n\n—— 来自 觅源 SeekAll`
    await navigator.clipboard.writeText(text)
    message.success('已复制资源信息')
  } catch {
    message.error('复制失败')
  }
}
</script>

<style scoped>
.share-card-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.share-card {
  position: relative;
  width: 380px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.card-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.share-card.dark .card-bg {
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.card-content {
  position: relative;
  z-index: 1;
  padding: 24px;
  color: #fff;
}

.card-title {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.4;
  margin-bottom: 12px;
  max-height: 80px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.card-tags {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.tag {
  font-size: 12px;
  padding: 2px 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(4px);
}

.card-password {
  font-size: 14px;
  margin-bottom: 16px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: 8px;
}

.card-password strong {
  font-size: 16px;
  font-family: monospace;
}

.card-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.qrcode {
  background: #fff;
  padding: 4px;
  border-radius: 8px;
}

.qrcode canvas {
  display: block;
}

.card-brand {
  flex: 1;
}

.brand-name {
  font-size: 16px;
  font-weight: 600;
}

.brand-url {
  font-size: 12px;
  opacity: 0.8;
}

.card-actions {
  display: flex;
  gap: 8px;
}
</style>
