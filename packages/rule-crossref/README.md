# @seekall/rule-crossref

> SeekAll L0 学术规则 - crossref.org 文献元数据搜索

## 安装

```bash
npm i @seekall/rule-crossref
```

## 用法

```ts
import { createEngine } from '@seekall/sdk'
import crossref from '@seekall/rule-crossref'

const engine = createEngine({ rules: [crossref] })
const hits = await engine.search('covid vaccine mrna')
```

## 元数据

| 字段 | 类型 | 说明 |
|---|---|---|
| doi | string | DOI（如 `10.1000/xyz123`） |
| authors | string | 作者列表（`Family, Given; Family, Given` 格式） |
| container | string | 期刊名 |
| published | string | 发布日期（YYYY-MM-DD） |

## 数据源

- API: `https://api.crossref.org/works`
- 风险评级：L0 学术纯净
- 不需要 API key（建议在 User-Agent 里填联系邮箱，crossref 会优先服务）

## License

MIT
