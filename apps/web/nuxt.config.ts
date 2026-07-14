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
          content: '觅源 SeekAll - 全网资源聚合搜索引擎，一站式搜索网盘、磁力、TG 频道资源',
        },
        { name: 'referrer', content: 'strict-origin-when-cross-origin' },
        { name: 'robots', content: 'noindex, nofollow' }, // 私人小圈子，不收录
        // PWA
        { name: 'theme-color', content: '#6366f1' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'apple-mobile-web-app-title', content: 'SeekAll' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'manifest', href: '/manifest.json' },
        { rel: 'apple-touch-icon', href: '/favicon.svg' },
      ],
    },
  },

  runtimeConfig: {
    // 服务端私有
    apiBase: process.env.NUXT_API_BASE || 'http://localhost:7301',
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
    // Sentry 模块（SENTRY_DSN 为空时自动跳过）
    '@sentry/nuxt',
  ],

  // Sentry 配置
  sentry: {
    dsn: process.env.NUXT_PUBLIC_SENTRY_DSN || '',
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_VERSION || '0.1.0',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    clientConfig: {
      // 前端错误采样率
      sampleRate: 1.0,
    },
  },

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
        proxy: `${process.env.NUXT_API_BASE || 'http://localhost:7301'}/api/**`,
      },
      '/docs': {
        proxy: `${process.env.NUXT_API_BASE || 'http://localhost:7301'}/docs`,
      },
      '/docs-json': {
        proxy: `${process.env.NUXT_API_BASE || 'http://localhost:7301'}/docs-json`,
      },
    },
  },

  // 生产环境关闭 sourcemap
  sourcemap: { server: false, client: false },

  // 隐藏 Nuxt 提示
  telemetry: false,
})
