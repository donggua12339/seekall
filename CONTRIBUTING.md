# 贡献指南

感谢你对觅源 SeekAll 的关注！本文档指导你如何参与贡献。

## 项目简介

SeekAll 是**中立的搜索规则引擎 SDK + 规则市场 + BaaS**，不是搜索网站。

- SDK（`@seekall/sdk`）在用户本机执行搜索，服务端零接触搜索内容
- 规则以 npm 包形式分发，社区贡献
- 5 级风险评级（L0-L4），合规设计内置于架构

详细规约见 [spec.md](./spec.md)，架构见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

## 行为准则

- 尊重所有贡献者
- 保持技术讨论聚焦
- 不接受任何破坏 5 条红线的代码（见下方"合规红线"）

## 开发环境搭建

```bash
# 克隆代码
git clone https://github.com/donggua12339/seekall.git
cd seekall

# 安装依赖（pnpm 9+，Node 20+）
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填写本地配置（DATABASE_URL / JWT_SECRET / REDIS_URL 等）

# 生成 Prisma Client
cd apps/api && npx prisma generate

# 初始化数据库（需要本地 MySQL 8 运行）
npx prisma db push
npx ts-node prisma/seed.ts

# 启动 API 开发服务
npx nest start --watch

# 启动前端开发服务（另开终端）
cd ../user-spa && pnpm dev    # 用户中心
cd ../admin && pnpm dev       # 管理后台
cd ../docs-site && pnpm dev   # 文档站
```

### Docker 方式（推荐生产部署）

```bash
cd docker
cp ../.env .env
docker compose up -d
```

## 代码规范

详见 [spec.md](./spec.md)。以下为摘要：

### TypeScript

- `strict: true`，禁止 `any`
- 优先 `interface`，联合类型 / 映射类型用 `type`
- 文件名 kebab-case，类名 PascalCase，函数 camelCase，常量 UPPER_SNAKE_CASE

### 格式化

- Prettier：2 空格缩进、单引号、无分号
- ESLint：`@typescript-eslint/recommended`
- 提交前 husky + lint-staged 自动格式化

### Conventional Commits

```
type(scope): subject
```

| type       | 用途               |
| ---------- | ------------------ |
| `feat`     | 新功能             |
| `fix`      | Bug 修复           |
| `docs`     | 文档               |
| `style`    | 格式（不影响逻辑） |
| `refactor` | 重构               |
| `perf`     | 性能优化           |
| `test`     | 测试               |
| `chore`    | 构建 / 工具        |

subject 必须小写开头，不超过 100 字符。

示例：`feat(search): pansou default-on and parallel rendering`

## 贡献规则包

规则包是 SeekAll 生态的核心贡献方式。每个规则是一个独立的 npm 包：

```bash
# 1. 创建规则包
mkdir packages/rule-my-source
cd packages/rule-my-source

# 2. 实现 Rule 接口
# src/index.ts
import type { Rule, Hit, RuleContext } from '@seekall/sdk'

export const myRule: Rule = {
  name: '@seekall/rule-my-source',
  version: '0.1.0',
  riskLevel: 0,  // L0 学术 / L1 开源 / L2 社区
  description: '我的数据源搜索规则',
  async run(query: string, ctx: RuleContext): Promise<Hit[]> {
    // 实现搜索逻辑
    return []
  }
}
export default myRule
```

```bash
# 3. 构建 + 发布
pnpm build
npm publish --access public

# 4. 提交到规则市场
# 在 SeekAll 用户中心 → 提交规则 → 填写 npm 包名 + 风险评级 + 描述
```

### 风险评级指南

| 级别  | 适用数据源                                | 审核流程                    |
| ----- | ----------------------------------------- | --------------------------- |
| L0    | 公开学术 API（arXiv / Crossref / PubMed） | 自动上架                    |
| L1    | 公开开源 API（GitHub / Hacker News）      | 自动上架                    |
| L2    | 社区 API（需评审）                        | 社群评审 ≥3 票 + admin 终审 |
| L3-L4 | 高风险源                                  | 仅 admin 可创建，永不公开   |

## 提交 PR

1. Fork 仓库
2. 创建功能分支：`git checkout -b feat/your-feature`
3. 编写代码，确保：
   - 通过 lint：pre-commit hook 自动检查
   - 通过测试：`cd apps/api && npx jest`
   - 遵守 [spec.md](./spec.md) 规约
4. 提交：`git commit -m "feat(xxx): 描述"`
5. 推送：`git push origin feat/your-feature`
6. 创建 PR，描述改了什么、为什么改、如何测试

## 报告 Bug

提交 Issue 时包含：

- 复现步骤
- 期望行为
- 实际行为
- 环境信息（浏览器 / Node 版本 / 操作系统）
- 相关截图或日志

## 功能建议

提交 Issue 时说明：

- 使用场景
- 期望的功能
- 是否有替代方案
- 是否愿意自己实现（PR welcome）

## 合规红线（不可逾越）

以下 PR 将被**直接拒绝**：

1. **SDK 默认包塞网盘 / 磁力 / 盗版站 Rule** — 默认只允许 L0 学术规则
2. **L3/L4 规则对非 admin 可见** — 即使付费也不行
3. **评论 / 评分 / 论坛功能** — 避免 UGC 内容责任
4. **服务端 rule 模块发 outbound HTTP** — `apps/api/src/modules/rule/` 禁止 axios/fetch/http
5. **集成支付 SDK** — 用 WM 卡 SKU + webhook，不接第三方支付

## 开源协议

- SDK 核心：[AGPL-3.0](./LICENSE)
- 规则插件：[MIT](./LICENSE.plugins)

贡献 SDK 代码即表示同意以 AGPL-3.0 开源。贡献规则包可选择 MIT。
