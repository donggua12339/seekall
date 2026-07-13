<template>
  <div>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>

<script setup lang="ts">
// 全局错误处理

useHead({
  titleTemplate: (title) => (title ? `${title} - 觅源 SeekAll` : '觅源 SeekAll'),
})
</script>
