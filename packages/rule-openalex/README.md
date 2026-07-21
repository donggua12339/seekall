# @seekall/rule-openalex

> SeekAll L2 付费独享规则 - OpenAlex 学术图谱搜索

## 风险评级

L2 付费独享 - 学术增强,需 monthly/lifetime 会员订阅。

## 特点

- 数据源 OpenAlex(2.5 亿+ 学术作品,完全开放)
- 无需 API key(建议设 `SEEKALL_MAILTO` 提高 rate limit)
- 支持摘要重建(从 inverted index)+ 引用数 + DOI + 概念标签

## 安装与用法

```bash
npm i @seekall/rule-openalex
export SEEKALL_MAILTO=your@email.com  # 可选,提高 rate limit
```

```ts
import { createEngine } from '@seekall/sdk'
import openalex from '@seekall/rule-openalex'

const engine = createEngine({ rules: [openalex], license: { tier: 'monthly' } })
const hits = await engine.search('transformer attention mechanism')
```

## 元数据

| 字段 | 类型 | 说明 |
|---|---|---|
| publicationYear | number | 发表年份 |
| citedByCount | number | 被引次数 |
| doi | string | DOI |
| authors | string | 作者列表 |
| type | string | 作品类型(article/book/...) |
| concepts | string[] | 概念标签(top 5,score>0.3) |
