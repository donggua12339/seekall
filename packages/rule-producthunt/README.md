# @seekall/rule-producthunt

> SeekAll L2 付费独享规则 - Product Hunt 产品搜索

## 风险评级

L2 付费独享 - 开发者热点,需 monthly/lifetime 会员订阅。

## 安装

```bash
npm i @seekall/rule-producthunt
```

## 用法

```ts
import { createEngine } from '@seekall/sdk'
import producthunt from '@seekall/rule-producthunt'

const engine = createEngine({
  rules: [producthunt],
  license: { tier: 'monthly' },
})
const hits = await engine.search('ai writing')
```

## 元数据

每条 Hit 的 `meta` 包含:

| 字段 | 类型 | 说明 |
|---|---|---|
| votes | number | 投票数(若可解析) |
| topics | string[] | 主题标签 |

## 数据源

Product Hunt 官方公开搜索页(https://www.producthunt.com/search),遵守 robots.txt + UA 标识。通过 HTML + JSON-LD 解析。

## 备注

- Product Hunt 有官方 GraphQL API,需申请 token。本规则用公开页面避免 token 门槛
- 如需更高频次,建议申请 PH API token 后自行改造
- NSFW/敏感内容由 PH 自身过滤
