# @seekall/rule-arxiv

> SeekAll L0 学术规则 - arxiv.org 论文搜索

## 安装

```bash
npm i @seekall/rule-arxiv
```

## 用法

```ts
import { createEngine } from '@seekall/sdk'
import arxiv from '@seekall/rule-arxiv'

const engine = createEngine({ rules: [arxiv] })
const hits = await engine.search('transformer attention')
```

## 元数据

每条 Hit 的 `meta` 包含：

| 字段 | 类型 | 说明 |
|---|---|---|
| arxivId | string | arxiv 论文 ID（如 `2507.12345v1`） |
| authors | string | 作者列表（分号分隔） |
| published | string | 发布日期（ISO 格式） |

## 数据源

- API: `http://export.arxiv.org/api/query`
- 风险评级：L0 学术纯净
- 不需要 API key

## License

MIT
