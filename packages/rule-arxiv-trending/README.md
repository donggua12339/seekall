# @seekall/rule-arxiv-trending

> SeekAll L2 付费独享规则 - arXiv 近期论文(趋势发现)

## 与 @seekall/rule-arxiv 的区别

- `rule-arxiv`(L0 免费): 全量搜索
- `rule-arxiv-trending`(L2 付费): 只返回最近 7 天 submitted 的论文,按时间倒序

## 安装与用法

```bash
npm i @seekall/rule-arxiv-trending
```

```ts
import { createEngine } from '@seekall/sdk'
import arxivTrending from '@seekall/rule-arxiv-trending'

const engine = createEngine({ rules: [arxivTrending], license: { tier: 'monthly' } })
const hits = await engine.search('transformer')
```

## 元数据

| 字段 | 类型 | 说明 |
|---|---|---|
| arxivId | string | arxiv 论文 ID |
| authors | string | 作者列表 |
| published | string | 发布日期(ISO) |

## 数据源

arXiv API,`submittedDate:[7天前 TO *]` 过滤 + `sortBy=submittedDate` 排序。无需 API key。
