# @seekall/rule-lastfm

> SeekAll L2 付费独享规则 - Last.fm 音乐搜索

## 环境变量

需配置 `LASTFM_API_KEY`,在 https://www.last.fm/api/account/create 免费申请。

## 安装与用法

```bash
npm i @seekall/rule-lastfm
export LASTFM_API_KEY=your_key
```

```ts
import { createEngine } from '@seekall/sdk'
import lastfm from '@seekall/rule-lastfm'

const engine = createEngine({ rules: [lastfm], license: { tier: 'monthly' } })
const hits = await engine.search('bohemian rhapsody')
```

## 元数据

| 字段 | 类型 | 说明 |
|---|---|---|
| trackName | string | 曲目名 |
| artist | string | 艺术家 |
| listeners | number | 听众数 |
| cover | string | 封面 URL |
