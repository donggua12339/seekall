# @seekall/rule-github

> SeekAll L1 通用开源规则 - GitHub 仓库搜索

## 安装

```bash
npm i @seekall/rule-github
```

## 用法

```ts
import { createEngine } from '@seekall/sdk'
import github from '@seekall/rule-github'

const engine = createEngine({ rules: [github] })
const hits = await engine.search('react state machine')
```

## 元数据

每条 Hit 的 `meta` 包含：

| 字段 | 类型 | 说明 |
|---|---|---|
| stars | number | 仓库 star 数 |
| language | string | 主语言 |
| topics | string[] | 主题标签 |
| owner | string | 仓库所有者 |

## 风险评级

L1 通用开源 - GitHub 公开仓库搜索，数据源为 GitHub 官方 Search API。

## 速率限制

未授权请求 60 req/hour（IP 限制）。如需更高速率，可在环境变量配 `GITHUB_TOKEN`，但本规则不主动读取 token（保持工具中性）。
