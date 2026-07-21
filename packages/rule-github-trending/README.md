# @seekall/rule-github-trending

> SeekAll L2 付费独享规则 - GitHub Trending 仓库搜索

## 风险评级

L2 付费独享 - 开发者热点,需 monthly/lifetime 会员订阅。

## 与 @seekall/rule-github 的区别

- `rule-github`(L1 免费): 全量搜索,按 stars 排序
- `rule-github-trending`(L2 付费): 只返回最近 7 天有更新的热门仓库,用于趋势发现

## 安装

```bash
npm i @seekall/rule-github-trending
```

## 用法

```ts
import { createEngine } from '@seekall/sdk'
import githubTrending from '@seekall/rule-github-trending'

const engine = createEngine({
  rules: [githubTrending],
  license: { tier: 'monthly' },
})
const hits = await engine.search('react state machine')
```

## 元数据

每条 Hit 的 `meta` 包含:

| 字段 | 类型 | 说明 |
|---|---|---|
| stars | number | 仓库 star 数 |
| language | string | 主语言 |
| topics | string[] | 主题标签 |
| owner | string | 仓库所有者 |
| pushedAt | string | 最近 push 时间(ISO) |
| createdAt | string | 创建时间(ISO) |

## 数据源

GitHub Search API v2,过滤 `pushed:>{7天前}` + 按 stars 降序。遵守 GitHub rate limit(未授权 60 req/hour/IP)。
