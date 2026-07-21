# @seekall/rule-igdb

> SeekAll L2 付费独享规则 - IGDB 游戏搜索

## 环境变量

需配置 `IGDB_CLIENT_ID` + `IGDB_CLIENT_SECRET`,在 https://dev.twitch.tv/console/apps 免费申请(Twitch 账号)。

```bash
export IGDB_CLIENT_ID=your_client_id
export IGDB_CLIENT_SECRET=your_client_secret
```

## 安装与用法

```bash
npm i @seekall/rule-igdb
```

```ts
import { createEngine } from '@seekall/sdk'
import igdb from '@seekall/rule-igdb'

const engine = createEngine({ rules: [igdb], license: { tier: 'monthly' } })
const hits = await engine.search('witcher 3')
```

## 元数据

| 字段 | 类型 | 说明 |
|---|---|---|
| gameId | number | IGDB 游戏 ID |
| rating | number | 评分(0-10) |
| ratingCount | number | 评分人数 |
| releaseDate | string | 发行日期(ISO) |

## 数据源

IGDB v4 API,用 Twitch OAuth client_credentials 拿 token。token 自动缓存(约 60 分钟)。rate limit 4 req/s。
