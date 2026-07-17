# 作者指南

## 准备工作

- npm 账号
- Node.js >= 20
- 一个 SeekAll 账号（¥18 月卡及以上才能上传）

## 包名约定

公开规则：`@seekall/rule-<name>`
个人规则：`@<your-npm-scope>/rule-<name>`

## 最小 Rule 模板

```ts
import type { Rule } from '@seekall/sdk'

const rule: Rule = {
  name: '@your-scope/rule-my',
  version: '1.0.0',
  riskLevel: 1,
  description: '搜索 xxx 官方 API',
  async run(query, ctx) {
    ctx.logger.info(`searching ${query}`)
    const res = await fetch(`https://api.example.com/search?q=${query}`, {
      signal: ctx.signal,
    })
    const data = await res.json()
    return data.items.map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.desc,
    }))
  },
}

export default rule
```

## package.json

```json
{
  "name": "@your-scope/rule-my",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "peerDependencies": {
    "@seekall/sdk": "^0.5.0"
  }
}
```

## 发布

```bash
npm run build
npm publish --access public
```

## 提交到市场

1. 在 SeekAll 规则市场点"提交规则"
2. 填写 npm 包名 + 风险级别 + 描述
3. 等待审核（L0/L1 通常 24h，L2 需社群评审）

## 作者徽章

累计发布 3 个 L0/L1 规则且无违规 -> 自动获得作者徽章。
徽章仅荣誉性，不影响功能权限。
