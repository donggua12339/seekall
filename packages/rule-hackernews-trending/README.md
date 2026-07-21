# @seekall/rule-hackernews-trending

> SeekAll L2 付费独享规则 - Hacker News 热门故事(高票过滤)

## 风险评级

L2 付费独享 - 开发者热点,需 monthly/lifetime 会员订阅。

## 与 @seekall/rule-hackernews 的区别

- `rule-hackernews`(L1 免费): 关键词搜索,按相关度
- `rule-hackernews-trending`(L2 付费): 按 popularity + 只返回 points >= 50 的热门故事,过去 7 天

## 安装

```bash
npm i @seekall/rule-hackernews-trending
```

## 用法

```ts
import { createEngine } from '@seekall/sdk'
import hnTrending from '@seekall/rule-hackernews-trending'

const engine = createEngine({
  rules: [hnTrending],
  license: { tier: 'monthly' },
})
const hits = await engine.search('rust')
```

## 元数据

每条 Hit 的 `meta` 包含:

| 字段 | 类型 | 说明 |
|---|---|---|
| points | number | 故事得分(>= 50) |
| author | string | 作者 |
| comments | number | 评论数 |
| createdAt | string | 创建时间(ISO) |
| objectId | string | HN 对象 ID |

## 数据源

HN Algolia Search API,按 popularity 排序 + `numericFilters=points>=50,created_at_i>={7天前}`。遵守 HN API rate limit。
