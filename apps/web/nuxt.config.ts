// 觅源 SeekAll - Nuxt 3 配置
export default defineNuxtConfig({
  compatibilityDate: '2024-07-13',
  devtools: { enabled: true },

  ssr: true,

  app: {
    head: {
      title: '觅源 SeekAll - 全网资源聚合搜索',
      htmlAttrs: { lang: 'zh-CN' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            '觅源 SeekAll - 全网资源聚合搜索引擎，一站式搜索网盘、磁力、TG 频道资源',
        },
        { name: 'referrer', content: 'strict-origin-when-cross-origin' },
        { name: 'robots', content: 'noindex, nofollow' }, // 私人小圈子，不收录
      ],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },

  runtimeConfig: {
    // 服务端私有
    apiBase: process.env.NUXT_API_BASE || 'http://localhost:3000',
    // 公开（前端可用）
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || '/api/v1',
      domain: process.env.APP_DOMAIN || 'localhost',
      adminDomain: process.env.ADMIN_DOMAIN || 'localhost',
    },
  },

  modules: [
    '@pinia/nuxt',
    '@vueuse/nuxt',
    '@unocss/nuxt',
    'nuxtjs-naive-ui',
    '@nuxtjs/color-mode',
  ],

  colorMode: {
    preference: 'auto',
    fallback: 'light',
    classSuffix: '',
  },

  unocss: {
    presets: [
      'uno',
      // Naive UI 兼容
    ],
    shortcuts: {
      'flex-center': 'flex items-center justify-center',
      'flex-between': 'flex items-center justify-between',
    },
  },

  typescript: {
    strict: true,
    typeCheck: false, // CI 时单独跑 typecheck
  },

  nitro: {
    preset: 'node-server',
    routeRules: {
      '/**': { ssr: true },
      // 代理 /api/** 到后端 NestJS（路径完整保留）
      '/api/**': {
        proxy: `${process.env.NUXT_API_BASE || 'http://localhost:3000'}/api/**`,
      },
      '/docs': {
        proxy: `${process.env.NUXT_API_BASE || 'http://localhost:3000'}/docs`,
      },
      '/docs-json': {
        proxy: `${process.env.NUXT_API_BASE || 'http://localhost:3000'}/docs-json`,
      },
    },
  },

  // 生产环境关闭 sourcemap
  sourcemap: { server: false, client: false },

  // 隐藏 Nuxt 提示
  telemetry: false,
})
