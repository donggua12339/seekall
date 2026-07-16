<template>
  <div class="about-container">
    <div class="container mx-auto px-4 py-12 max-w-4xl">
      <div class="text-center mb-12">
        <div class="text-5xl mb-4">🔍</div>
        <h1 class="text-4xl font-bold mb-3 title-gradient">觅源 SeekAll</h1>
        <p class="text-gray-600 dark:text-gray-400 text-lg">觅寻全网资源，一站即达</p>
      </div>

      <section class="mb-10">
        <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2">
          <span class="text-indigo-500">📖</span> 项目介绍
        </h2>
        <div class="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 leading-relaxed">
          <p>
            <strong>觅源 SeekAll</strong> 是一个全网资源聚合搜索引擎，支持网盘、磁力、TG 频道、资源论坛等多源搜索。
            我们只做<strong>链接聚合</strong>，绝不存储任何文件内容，所有资源均来自第三方公开索引。
          </p>
          <p class="mt-3">
            项目以 <strong>AGPL-3.0</strong> 协议开源，秉承"小圈子共享、合规优先"的理念，
            通过邀请码控制访问范围，致力于为用户提供高效、安全、合规的资源检索体验。
          </p>
        </div>
      </section>

      <section class="mb-10">
        <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2">
          <span class="text-indigo-500">✨</span> 核心特性
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="feature-card">
            <div class="text-2xl mb-2">⚡</div>
            <h3 class="font-semibold mb-1">多源并发</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">Provider 插件化架构，多源并行检索，结果聚合去重</p>
          </div>
          <div class="feature-card">
            <div class="text-2xl mb-2">🔒</div>
            <h3 class="font-semibold mb-1">合规优先</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">关键词过滤、takedown 流程、免责声明，完整合规框架</p>
          </div>
          <div class="feature-card">
            <div class="text-2xl mb-2">🚀</div>
            <h3 class="font-semibold mb-1">高速缓存</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">Redis 分级 TTL + Meilisearch 全文检索，毫秒级响应</p>
          </div>
          <div class="feature-card">
            <div class="text-2xl mb-2">🤖</div>
            <h3 class="font-semibold mb-1">生态扩展</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">TG Bot、浏览器插件、API 开放、自定义 Provider 插件</p>
          </div>
          <div class="feature-card">
            <div class="text-2xl mb-2">🛡️</div>
            <h3 class="font-semibold mb-1">失效检测</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">BullMQ 定时检测链接状态，过滤失效资源</p>
          </div>
          <div class="feature-card">
            <div class="text-2xl mb-2">📦</div>
            <h3 class="font-semibold mb-1">PWA 支持</h3>
            <p class="text-sm text-gray-500 dark:text-gray-400">可安装到桌面/手机，离线可用，体验如原生应用</p>
          </div>
        </div>
      </section>

      <section class="mb-10">
        <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2">
          <span class="text-indigo-500">⚖️</span> 法律声明
        </h2>
        <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-5 text-sm leading-relaxed">
          <p class="mb-2"><strong>1. 本站性质：</strong>SeekAll 是资源链接聚合搜索引擎，<strong>不存储任何文件内容</strong>，
            所有搜索结果均链接至第三方平台。本站不复制、不传播任何受版权保护的内容。</p>
          <p class="mb-2"><strong>2. 用户责任：</strong>用户应仅出于个人学习、研究目的使用本站，<strong>禁止商业用途</strong>。
            下载、使用第三方资源所产生的任何法律责任由用户自行承担。</p>
          <p class="mb-2"><strong>3. 侵权举报：</strong>若您是权利人且发现本站索引了侵犯您权益的链接，
            请通过
            <NuxtLink to="/takedown" class="text-indigo-600 underline">侵权举报页面</NuxtLink>
            提交申请，我们将在 <strong>24 小时内</strong>响应并下架相关链接。</p>
          <p><strong>4. 关键词过滤：</strong>本站对所有用户实施统一的关键词黑名单过滤，
            不存在会员分级过滤机制，确保所有用户访问范围一致。</p>
        </div>
      </section>

      <section class="mb-10">
        <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2">
          <span class="text-indigo-500">📫</span> 联系方式
        </h2>
        <div class="space-y-2 text-gray-700 dark:text-gray-300">
          <p>📧 侵权举报：<NuxtLink to="/takedown" class="text-indigo-600 hover:underline">/takedown</NuxtLink></p>
          <p>📜 用户协议：<NuxtLink to="/agreement" class="text-indigo-600 hover:underline">/agreement</NuxtLink></p>
          <p>🐙 开源协议：AGPL-3.0（未来公开）</p>
        </div>
      </section>

      <section class="mb-10">
        <h2 class="text-2xl font-semibold mb-4 flex items-center gap-2">
          <span class="text-indigo-500">🙏</span> 致谢
        </h2>
        <div class="text-gray-700 dark:text-gray-300 leading-relaxed">
          <p>本项目参考了以下优秀开源项目：</p>
          <ul class="list-disc list-inside mt-2 space-y-1">
            <li><a href="https://github.com/fish2018/pansou" target="_blank" rel="noopener" class="text-indigo-600 hover:underline">PanSou</a> - 网盘资源搜索</li>
            <li><a href="https://github.com/joyce677/panhub" target="_blank" rel="noopener" class="text-indigo-600 hover:underline">PanHub</a> - 多资源站聚合</li>
            <li><a href="https://www.meilisearch.com" target="_blank" rel="noopener" class="text-indigo-600 hover:underline">Meilisearch</a> - 开源搜索引擎</li>
          </ul>
        </div>
      </section>

      <div class="text-center py-8 border-t border-gray-200 dark:border-gray-800">
        <NuxtLink
          to="/"
          class="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
        >
          开始搜索 →
        </NuxtLink>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({
  title: '关于我们 - 觅源 SeekAll',
  meta: [
    { name: 'description', content: '觅源 SeekAll - 全网资源聚合搜索引擎，只做链接聚合，不存储文件内容，AGPL-3.0 开源协议。' },
  ],
})
</script>

<style scoped>
.feature-card {
  @apply p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50;
}
.title-gradient {
  @apply bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-600;
}
</style>
