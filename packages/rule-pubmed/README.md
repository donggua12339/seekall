# @seekall/rule-pubmed

> SeekAll L0 学术规则 - pubmed 生物医学文献搜索

## 安装

```bash
npm i @seekall/rule-pubmed
```

## 用法

```ts
import { createEngine } from '@seekall/sdk'
import pubmed from '@seekall/rule-pubmed'

const engine = createEngine({ rules: [pubmed] })
const hits = await engine.search('cancer immunotherapy')
```

## 元数据

| 字段 | 类型 | 说明 |
|---|---|---|
| pmid | string | PubMed ID |
| authors | string | 作者列表（逗号分隔） |
| journal | string | 期刊名 |
| published | string | 发布日期 |

## 数据源

- API: NCBI E-utilities (`eutils.ncbi.nlm.nih.gov`)
- 风险评级：L0 学术纯净
- 不需要 API key（低频调用）
- 流程：esearch (拿 PMID 列表) -> esummary (拿元数据)

## License

MIT
