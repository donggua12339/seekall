# Engine API

## createEngine

```ts
import { createEngine } from '@seekall/sdk'

const engine = createEngine({
  rules: [rule1, rule2, rule3],
  concurrency: 5,
  timeoutMs: 10000,
})
```

## engine.search

```ts
const hits = await engine.search('transformer', {
  signal: controller.signal,
  onHit: (hit) => console.log(hit),
})
```

## engine.addRule / removeRule

```ts
engine.addRule(newRule)
engine.removeRule('@my-org/my-rule')
```

## engine.listRules

```ts
const rules = engine.listRules()
```

## 去重算法

按 `url` 字段去重，保留首次出现的 Hit。
相同 url 的不同来源会合并到 `meta.sources` 数组。

## 错误处理

- 单条规则抛错：记录日志，不影响其他规则
- 规则超时：自动 abort，记录 warn 日志
- 全部规则失败：返回空数组，不抛错
