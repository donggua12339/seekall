<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<template>
  <div class="not-found">
    <h1>404</h1>
    <p>页面不存在</p>
    <n-button type="primary" @click="router.push('/dashboard')">回到首页</n-button>
  </div>
</template>

<style scoped>
.not-found {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
}
.not-found h1 {
  font-size: 96px;
  margin: 0;
  color: #9ca3af;
}
.not-found p {
  color: #6b7280;
  margin: 0 0 16px 0;
}
</style>
