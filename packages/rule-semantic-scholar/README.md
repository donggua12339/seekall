# @seekall/rule-semantic-scholar

> SeekAll L2 付费独享规则 - Semantic Scholar 论文搜索

## 风险评级

L2 付费独享 - 学术增强,需 monthly/lifetime 会员订阅。

## 特点

- 数据源 Semantic Scholar(2 亿+ 论文 + AI 增强摘要 tldr)
- 无需 API key(无 key 100 req/5min,有 key 1 req/s)
- 可选环境变量 `S2_API_KEY`(https://www.semanticscholar.org/product/api 申请)

## 安装与用法

```bash
npm i @seekall/rule-semantic-scholar
export S2_API_KEY=your_key  # 可选
```

```ts
import { createEngine } from '@seekall/sdk'
import s2 from '@seekall/rule-semantic-scholar'

const engine = createEngine({ rules: [s2], license: { tier: 'monthly' } })
const hits = await engine.search('transformer attention')
```

## 元数据

| 字段 | 类型 | 说明 |
|---|---|---|
| paperId | string | S2 论文 ID |
| year | number | 发表年份 |
| citationCount | number | 被引次数 |
| venue | string | 期刊/会议 |
| authors | string | 作者列表 |
| tldr | string | AI 生成摘要 |
| openAccessPdf | string | 开放获取 PDF URL |
