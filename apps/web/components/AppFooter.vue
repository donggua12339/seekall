<template>
  <footer class="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 mt-12">
    <div class="container mx-auto px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
      <div class="space-x-3 mb-2">
        <NuxtLink to="/agreement" class="hover:text-indigo-600">用户协议</NuxtLink>
        <span>|</span>
        <NuxtLink to="/takedown" class="hover:text-indigo-600">侵权举报</NuxtLink>
        <span>|</span>
        <NuxtLink to="/about" class="hover:text-indigo-600">关于</NuxtLink>
      </div>
      <p class="text-xs">
        © {{ new Date().getFullYear() }} 觅源 SeekAll · AGPL-3.0 · 本站仅做链接聚合，不存储任何文件内容
      </p>
    </div>
  </footer>
</template>

<script setup lang="ts">
</script>
