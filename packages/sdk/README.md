# @seekall/sdk

> SeekAll 规则引擎 SDK - 中立的搜索规则 + 市场

一个 npm 包，让你在本机跑搜索规则。规则在你机器上执行，服务端零接触资源。

## 安装

```bash
npm i @seekall/sdk
```

## 最小用法

```ts
import { createEngine } from '@seekall/sdk'

const engine = createEngine({ rules: [] })
const hits = await engine.search('test')
// 默认 0 个规则 -> 输出 []
```

## 配合规则使用

```bash
npm i @seekall/rule-arxiv
```

```ts
import { createEngine } from '@seekall/sdk'
import arxiv from '@seekall/rule-arxiv'

const engine = createEngine({ rules: [arxiv] })
const hits = await engine.search('transformer attention')
console.log(hits)
```

## CLI 命令

SDK 自带 CLI(`seekall`),装完即可用:

```bash
# 搜索(默认带 3 个 L0 规则: arxiv + crossref + pubmed)
npx @seekall/sdk search transformer

# 指定规则
npx @seekall/sdk search transformer -r @seekall/rule-github -r @seekall/rule-hackernews

# JSON 输出(适合管道)
npx @seekall/sdk search transformer -o json | jq '.[0].title'

# 配置管理(~/.seekall/config.json)
npx @seekall/sdk config set license SA-TRY-xxxx
npx @seekall/sdk config set serverUrl https://seekall.winmelon.cn
npx @seekall/sdk config list

# License 激活
npx @seekall/sdk license redeem SA-TRY-xxxx

# 同步服务器订阅规则
npx @seekall/sdk sync

# 查看当前 license 信息
npx @seekall/sdk whoami

# 列出可用规则
npx @seekall/sdk rules list

# 初始化新项目(脚手架)
npx @seekall/sdk init my-seekall-app
```

### 配置优先级

CLI 配置按 `env > config file > param` 优先级解析:

| 来源 | 环境变量 | 配置项 |
|---|---|---|
| env | `SEEKALL_SERVER_URL` | serverUrl |
| env | `SEEKALL_LICENSE` | license |
| env | `SEEKALL_OUTPUT_FORMAT` | outputFormat |
| 文件 | `~/.seekall/config.json` | 所有项 |
| 参数 | `--rule` / `--output` | 覆盖默认 |

## API

### createEngine(options)

创建搜索引擎实例。

| 参数 | 类型 | 默认 | 说明 |
|---|---|---|---|
| options.rules | `Rule[]` | `[]` | 规则数组 |
| options.concurrency | `number` | `5` | 并发执行规则数 |
| options.timeoutMs | `number` | `10000` | 单条规则超时(毫秒) |
| options.license | `LicenseContext` | `{ tier: 'free' }` | License 上下文 |
| options.logger | `RuleLogger` | console | 日志接口 |

### engine.search(query, options?)

搜索并返回去重后的 Hit 数组。

| 参数 | 类型 | 说明 |
|---|---|---|
| query | `string` | 搜索关键词 |
| options.signal | `AbortSignal` | 取消搜索 |
| options.onHit | `(hit, ruleName) => void` | 流式回调(每条规则完成时触发) |

返回 `Promise<Hit[]>`,按 url 去重。

### engine.addRule(rule) / engine.removeRule(name)

运行时增删规则。

### engine.listRules()

列出当前已加载的规则(仅元数据)。

## 类型

```ts
interface Rule {
  name: string
  version: string
  riskLevel: 0 | 1 | 2 | 3 | 4
  description: string
  run(query: string, ctx: RuleContext): Promise<Hit[]>
}

interface Hit {
  title: string
  url: string
  snippet?: string
  source?: string
  meta?: Record<string, unknown>
}

interface RuleContext {
  signal: AbortSignal
  license: { tier: 'free' | 'trial' | 'monthly' | 'lifetime' | 'admin'; expiresAt?: Date }
  logger: RuleLogger
}
```

## 错误处理

- 单条规则抛错:记录 warn 日志,不影响其他规则
- 规则超时:自动 abort,记录 warn 日志
- 全部规则失败:返回空数组,不抛错

## 去重算法

按 `url` 字段去重,保留首次出现的 Hit。
相同 url 的不同来源会合并到 `meta.sources` 数组:

```json
{
  "title": "...",
  "url": "https://arxiv.org/abs/2507.12345",
  "meta": {
    "sources": ["@seekall/rule-arxiv", "@seekall/rule-crossref"]
  }
}
```

## License

AGPL-3.0
