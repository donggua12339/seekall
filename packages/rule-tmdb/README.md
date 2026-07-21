# @seekall/rule-tmdb

> SeekAll L2 付费独享规则 - TMDB 电影/电视搜索

## 风险评级

L2 付费独享 - 文娱热点,需 monthly/lifetime 会员订阅。

## 环境变量

需配置 `TMDB_API_KEY`,在 https://www.themoviedb.org/settings/api 免费申请。

```bash
export TMDB_API_KEY=your_key_here
```

## 安装

```bash
npm i @seekall/rule-tmdb
```

## 用法

```ts
import { createEngine } from '@seekall/sdk'
import tmdb from '@seekall/rule-tmdb'

const engine = createEngine({
  rules: [tmdb],
  license: { tier: 'monthly' },
})
const hits = await engine.search('inception')
```

## 元数据

| 字段 | 类型 | 说明 |
|---|---|---|
| mediaType | string | movie / tv |
| poster | string | 海报 URL |
| releaseDate | string | 上映/首播日期 |
| voteAverage | number | 评分(0-10) |
| voteCount | number | 评分人数 |

## 数据源

TMDB 官方 API,免费申请 key,rate limit 40 req/10s。
