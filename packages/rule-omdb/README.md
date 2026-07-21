# @seekall/rule-omdb

> SeekAll L2 付费独享规则 - OMDB 电影搜索

## 环境变量

需配置 `OMDB_API_KEY`,在 https://www.omdbapi.com/apikey.aspx 免费申请(1000 req/day)。

## 安装与用法

```bash
npm i @seekall/rule-omdb
export OMDB_API_KEY=your_key
```

```ts
import { createEngine } from '@seekall/sdk'
import omdb from '@seekall/rule-omdb'

const engine = createEngine({ rules: [omdb], license: { tier: 'monthly' } })
const hits = await engine.search('inception')
```

## 元数据

| 字段 | 类型 | 说明 |
|---|---|---|
| imdbId | string | IMDB ID |
| year | string | 年份 |
| type | string | movie/series/episode |
| poster | string | 海报 URL |
| imdbRating | number | IMDB 评分 |
