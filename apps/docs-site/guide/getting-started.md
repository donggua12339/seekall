# 快速开始

## 1. 安装 SDK

```bash
npm i @seekall/sdk
```

## 2. 安装一个规则

```bash
npm i @seekall/rule-arxiv
```

## 3. 搜索

```ts
import { createEngine } from '@seekall/sdk'
import arxiv from '@seekall/rule-arxiv'

const engine = createEngine({ rules: [arxiv] })
const hits = await engine.search('transformer')
console.log(hits)
```

## 默认 0 个规则

SeekAll 默认不内置任何指向具体网盘 / 磁力站 / 盗版论坛的规则。
你需要自己从 [规则市场](/rules/) 挑选，或[自己写规则](/sdk/rule-interface)。

这是合规设计，不是 bug。

## 下一步

- [它是什么](what-is-seekall) - 理解设计思路
- [5 级风险评级](risk-levels) - 了解规则分级
- [SDK 安装](/sdk/) - 完整 SDK 文档
