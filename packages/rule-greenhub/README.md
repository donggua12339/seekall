# @seekall/rule-greenhub

全网绿色资源聚合搜索规则 - 多源并行，聚合以下站点的搜索结果：

| 数据源 | 类型 | 地址 |
|--------|------|------|
| 果核剥壳 | 绿色软件 | ghxi.com |
| 423down | 便携软件 | 423down.com |
| 殁漂遥 | 绿色资源 | mpyit.com |
| 乐软博客 | 实用工具 | isharepc.com |
| 小众软件 | 发现好软件 | appinn.com |

## 风险评级

**L2** - 社区评审通过后上架。聚合搜索本身中立，不托管任何资源。

## 安装

```bash
npm install @seekall/rule-greenhub
```

## 使用

```ts
import { createEngine } from '@seekall/sdk'
import greenhub from '@seekall/rule-greenhub'

const engine = createEngine({ rules: [greenhub] })
const hits = await engine.search('Everything 搜索工具')

for (const hit of hits) {
  console.log(`[${hit.source}] ${hit.title}`)
  console.log(`  ${hit.url}`)
}
```

## 特性

- 5 源并行搜索，单源超时/失败不影响整体
- 自动按 URL 去重
- 响应 `ctx.signal` 取消
- 每源最多返回 15 条，总计最多 75 条

## 开发

```bash
pnpm install
pnpm build        # tsup 编译
pnpm typecheck    # 类型检查
```

## License

MIT
