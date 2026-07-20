# @seekall/rule-hackernews

> SeekAll L1 通用开源规则 - Hacker News 故事搜索

## 安装

```bash
npm i @seekall/rule-hackernews
```

## 用法

```ts
import { createEngine } from '@seekall/sdk'
import hackernews from '@seekall/rule-hackernews'

const engine = createEngine({ rules: [hackernews] })
const hits = await engine.search('rust async runtime')
```

## 元数据

每条 Hit 的 `meta` 包含：

| 字段 | 类型 | 说明 |
|---|---|---|
| points | number | 故事得分 |
| author | string | 作者 |
| comments | number | 评论数 |
| createdAt | string | 创建时间（ISO） |
| objectId | string | HN 对象 ID |

## 风险评级

L1 通用开源 - Hacker News 公开故事搜索，数据源为 Algolia HN Search API（官方提供的搜索服务）。

## 备注

- 如果故事没有外部 url（如 Ask HN），`url` 指向 HN 讨论页
- `snippet` 去除 HTML 标签，截断 280 字符
