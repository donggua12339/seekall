# SDK 安装

```bash
npm i @seekall/sdk
```

## 系统要求

- Node.js >= 20.0.0
- pnpm >= 9.0.0（仅开发时）

## 验证安装

```ts
import { createEngine } from '@seekall/sdk'

const engine = createEngine({ rules: [] })
const hits = await engine.search('test')

console.log(`命中 ${hits.length} 条`)
// 默认 0 个规则 -> 输出 "命中 0 条"
```

## 下一步

- [Rule 接口](rule-interface) - 自己写一个规则
- [Engine API](engine) - 了解搜索引擎的全部方法
- [示例](examples) - 3 个内置示例规则
