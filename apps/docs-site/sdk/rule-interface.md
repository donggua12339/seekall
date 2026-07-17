# Rule 接口

每条 Rule 是一个对象，实现 `Rule` 接口：

```ts
import type { Rule, Hit } from '@seekall/sdk'

const myRule: Rule = {
  name: '@my-org/my-rule',
  version: '1.0.0',
  riskLevel: 1,
  description: '搜索 arxiv.org 学术论文',
  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    const url = `https://arxiv.org/abs/${query}`
    const res = await fetch(url)
    return [{ title: '...', url: '...', snippet: '...' }]
  },
}

export default myRule
```

## Hit 类型

```ts
interface Hit {
  title: string
  url: string
  snippet?: string
  source?: string
  meta?: Record<string, unknown>
}
```

## RuleContext

```ts
interface RuleContext {
  signal: AbortSignal
  license: {
    tier: 'free' | 'trial' | 'monthly' | 'lifetime' | 'admin'
    expiresAt?: Date
  }
  logger: {
    debug: (msg: string, data?: unknown) => void
    info: (msg: string, data?: unknown) => void
    warn: (msg: string, data?: unknown) => void
    error: (msg: string, data?: unknown) => void
  }
}
```

## 约束

- Rule **不得**向服务端发请求（仅用户机器内执行）
- Rule **必须**响应 `signal` 取消
- Rule **不得**写文件系统（沙箱限制）
- Rule **必须**声明正确的 `riskLevel`，谎报将导致作者封禁

## 发布

1. 把 Rule 打包成 npm 包
2. 发布到 npmjs.com
3. 在 SeekAll 规则市场提交审核
