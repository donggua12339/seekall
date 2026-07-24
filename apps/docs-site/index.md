---
layout: home

hero:
  name: SeekAll
  text: 网盘 / 磁力聚合搜索的规则引擎
  tagline: 中立的搜索规则 SDK + 市场。规则在你机器上跑，服务端零接触。
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 它是什么
      link: /guide/what-is-seekall
    - theme: alt
      text: GitHub
      link: https://github.com/donggua12339/seekall

features:
  - title: 纯工具
    details: 一个 npm 包 npm i @seekall/sdk，不是网站服务。SDK 在你本机跑，结果汇总去重。
  - title: 规则市场
    details: 规则由社区贡献，5 级风险评级（L0-L4）。不内置任何指向具体网盘 / 磁力站 / 盗版论坛的默认规则。
  - title: 5 维权限矩阵
    details: View / Run / Save / Upload / Author 五种权限严格映射会员档，L3/L4 规则仅 admin 可见。
  - title: 双协议
    details: SDK 核心 AGPL-3.0，插件 MIT。规则通过 npm 分发，不是中心化仓库。
  - title: 合规设计
    details: 站点零接触盗版源。DMCA 邮箱 1660069758@qq.com，Takedown 24h 内人工响应。
  - title: 会员不强制
    details: 免费可用 L0-L1 规则。¥1 试用 / ¥18 月卡 / ¥68 永久（主推），老用户每月可发 3 个 ¥1 邀请码。
---

## 最新动态

### 2026-07-23 · v0.6 第二波

- **贡献者徽章系统上线**：贡献者 / 评审员 / 早期用户三类徽章，user-spa Dashboard 展示
- **贡献者排行榜上线**：[/contributors](./contributors/) 按已发布规则数排序，Top 3 颁奖台展示
- **贡献者邀请计划**：提交 1 个 L0/L1 规则换终身会员（限量 20 个），详见 [邀请计划](./contributors/contributor-invite)
- **博客上线**：[100 行代码构建搜索聚合工具](./blog/tutorial-100-lines) + [为什么不做搜索网站只做 SDK](./blog/why-not-website)

### 2026-07-22 · v0.6 第一波

- **邀请码裂变**：月度/终身会员每月可生成 3 个 ¥1 试用邀请码
- **CLI 完整命令集**：`seekall search / license redeem / sync / rules list / config / whoami`
- **npm 下载量统计**：规则市场 + admin Dashboard 展示上周下载量

### 2026-07-18 · v0.5 重构上线

- 从 Nuxt Web 搜索网站重构为**规则引擎 SDK + 市场 + BaaS**
- 5 张核心表 + 4 张辅助表，7 个 Docker 容器
- DMCA §512(c) 合规流程 + 5 级风险评级 + WM 卡 webhook

---

## 开始使用

```bash
# 1. 安装 SDK
npm i @seekall/sdk @seekall/rule-arxiv

# 2. 3 行代码跑起来
node -e "
import { createEngine } from '@seekall/sdk'
import arxiv from '@seekall/rule-arxiv'
const engine = createEngine({ rules: [arxiv] })
const hits = await engine.search('transformer')
hits.forEach(h => console.log(h.title))
"
```

详见 [快速开始](./guide/getting-started)。

## 贡献

- **写规则**：参考 [作者指南](./rules/author-guide)，10 行代码就能写一个规则
- **提建议**：发邮件到 1660069758@qq.com
- **拉新**：在掘金 / V2EX / 即刻分享 [博客文章](./blog/)

## 合规

- 5 条不可逾越的红线（见 [它是什么](./guide/what-is-seekall)）
- DMCA 邮箱：1660069758@qq.com
- 透明度报告：[/compliance](./compliance/)
