import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'SeekAll',
  description: '网盘 / 磁力聚合搜索的规则引擎 - 中立的搜索规则 SDK + 市场',
  lang: 'zh-CN',
  lastUpdated: true,
  cleanUrls: true,

  head: [
    ['meta', { name: 'referrer', content: 'no-referrer' }],
    ['meta', { name: 'theme-color', content: '#3aa675' }],
  ],

  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '指南', link: '/guide/getting-started' },
      { text: 'SDK', link: '/sdk/' },
      { text: '规则市场', link: '/rules/' },
      { text: '博客', link: '/blog/' },
      { text: '贡献者', link: '/contributors/' },
      { text: 'API', link: '/api/' },
      { text: '合规', link: '/compliance/' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '开始',
          items: [
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '它是什么', link: '/guide/what-is-seekall' },
            { text: '它不是什么', link: '/guide/what-it-is-not' },
          ],
        },
        {
          text: '风险评级',
          items: [
            { text: '5 级风险 (L0-L4)', link: '/guide/risk-levels' },
            { text: '5 维权限矩阵', link: '/guide/permission-matrix' },
          ],
        },
        {
          text: '会员',
          items: [
            { text: '会员档位', link: '/guide/membership' },
            { text: '试用码机制', link: '/guide/trial-code' },
          ],
        },
      ],
      '/sdk/': [
        {
          text: 'SDK',
          items: [
            { text: '安装', link: '/sdk/' },
            { text: 'Rule 接口', link: '/sdk/rule-interface' },
            { text: 'Engine API', link: '/sdk/engine' },
            { text: '示例', link: '/sdk/examples' },
          ],
        },
      ],
      '/rules/': [
        {
          text: '规则市场',
          items: [
            { text: '概览', link: '/rules/' },
            { text: '评审工作流', link: '/rules/review' },
            { text: '作者指南', link: '/rules/author-guide' },
          ],
        },
      ],
      '/blog/': [
        {
          text: '博客',
          items: [
            { text: '100 行代码构建搜索聚合', link: '/blog/tutorial-100-lines' },
            { text: '为什么不做网站只做 SDK', link: '/blog/why-not-website' },
          ],
        },
      ],
      '/contributors/': [
        {
          text: '贡献者',
          items: [
            { text: '排行榜', link: '/contributors/' },
            { text: '贡献者邀请计划', link: '/contributors/contributor-invite' },
          ],
        },
      ],
      '/compliance/': [
        {
          text: '合规',
          items: [
            { text: '合规框架', link: '/compliance/' },
            { text: 'DMCA 流程', link: '/compliance/dmca' },
            { text: 'Takedown 政策', link: '/compliance/takedown' },
          ],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/donggua12339/seekall' },
    ],

    footer: {
      message: 'AGPL-3.0 开源 | DMCA: 1660069758@qq.com',
      copyright: 'Copyright © 2026 SeekAll Contributors',
    },

    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一页', next: '下一页' },
    lastUpdatedText: '最后更新',
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '菜单',
    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
  },
})
