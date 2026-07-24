# 小红书软文初稿

> 3 个标题备选 + 1 篇正文骨架 + 红线清单

## 标题（3 个备选）

- A. 我做了一款规则引擎 SDK，让你自己定义"搜什么"
- B. npm 包也能跑规则？聊聊我做的 @seekall/sdk
- C. 技术分享：如何用 TypeScript 搭一个中立的规则引擎

## 正文骨架（300-500 字）

```
[痛点开头]
做学术研究 / 技术调研的时候，经常要在 arxiv、crossref、pubmed 之间来回切，
同一个关键词复制粘贴 3 遍。有没有一个工具能让我在终端里一个命令跑完所有源？

[产品介绍]
我做了一个 npm 包 @seekall/sdk，核心思路是：
- "搜索" = 一个规则数组
- 你自己写规则（10 行代码 / 接官方 API）
- SDK 在你本机跑，结果汇总去重
- 完全客户端执行，服务端零接触

[差异化]
和市面上"xxx 聚合"网站不一样：
- 我不做网站服务，只发 npm 包
- 我不内置任何默认规则（默认 0 规则，自己装）
- 我做的是"规则引擎"，规则通过 npm 分发，社区贡献并标 5 级风险评级

[风险评级]
L0 学术纯净（arxiv / crossref / pubmed）-> L1 通用开源 -> L2 社区评审
-> L3/L4 高风险（仅 admin 可见，永不公开）
工具中性合规设计，服务端零接触资源。

[技术点]
- monorepo（pnpm 9）+ TypeScript + tsup
- Rule interface 极简（name + search + onHit 流式回调）
- 规则通过 npm 分发（不是中心化仓库）
- License 用 license key（不是订阅 SaaS）

[CTA]
文档站 seekall.winmelon.cn
npm i @seekall/sdk 即可开始
AGPL-3.0 协议，欢迎贡献规则。
3 个 L0 示例规则已发 npm：@seekall/rule-arxiv / rule-crossref / rule-pubmed
```

## 红线（绝对不能写）

- ❌ "搜盗版" "搜资源" "海量资源"
- ❌ 任何具体网盘站名（夸克 / 阿里 / 123pan 等）
- ❌ 任何 magnet / bt / 种子
- ❌ "破解" "免费下" "无水印"
- ❌ 截图首页展示具体搜索结果

## 发布渠道优先级

1. 小红书技术类目（首推）
2. V2EX /create 节点
3. 掘金 / SegmentFault 思否
4. 即刻 / Twitter（英文版）
5. B 站技术分享视频（可选）

## 配图建议（不违规）

- SDK 代码截图（Terminal 风格）
- 规则市场列表页（仅显示 L0 学术规则）
- 架构图（用户机器 -> SDK -> npm 规则）
- 5 级风险评级表格
- 不要截图具体搜索结果
