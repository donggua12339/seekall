# @seekall/rule-reddit

> SeekAll L2 付费独享规则 - Reddit 热门帖子搜索

## 风险评级

L2 付费独享 - 开发者热点,需 monthly/lifetime 会员订阅。

## 安装

```bash
npm i @seekall/rule-reddit
```

## 用法

```ts
import { createEngine } from '@seekall/sdk'
import reddit from '@seekall/rule-reddit'

const engine = createEngine({
  rules: [reddit],
  license: { tier: 'monthly' }, // 付费用户
})
const hits = await engine.search('rust async runtime')
```

## 元数据

每条 Hit 的 `meta` 包含:

| 字段 | 类型 | 说明 |
|---|---|---|
| score | number | 帖子得分(upvote - downvote) |
| comments | number | 评论数 |
| author | string | 作者 |
| subreddit | string | 子版块(如 r/programming) |
| createdAt | string | 创建时间(ISO) |

## 数据源

Reddit 官方 JSON API (`https://www.reddit.com/search.json`),遵守 robots.txt + 频控 + UA 标识。自动过滤 NSFW 帖子。
