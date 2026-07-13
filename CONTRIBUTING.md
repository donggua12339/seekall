# 贡献指南

感谢你对 觅源 SeekAll 的关注！本文档指导你如何参与贡献。

## 行为准则

- 尊重所有贡献者
- 保持技术讨论聚焦
- 不接受任何破坏 Z++ 合规红线的代码（会员分级过滤、侵权资源访问权等）

## 开发环境搭建

参考 [部署文档](./docs/DEPLOY.md) 的本地开发部分：

```bash
# 克隆代码
git clone https://github.com/donggua12339/seekall.git
cd seekall

# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填写本地配置

# 生成 Prisma Client
pnpm --filter api prisma:generate

# 初始化数据库
pnpm --filter api prisma db push
pnpm --filter api prisma:seed

# 创建管理员
pnpm --filter api cli:setup-admin admin admin@example.com YourPassword

# 启动开发服务
pnpm dev
```

## 代码规范

### TypeScript
- `strict: true`，禁用 `any`
- 优先 `interface`，类型推导不足时用 `type`
- 显式标注返回类型

### 命名约定
- 文件名：kebab-case（`invite-code.service.ts`）
- 类名：PascalCase（`InviteCodeService`）
- 函数/变量：camelCase（`searchAll`）
- 常量：UPPER_SNAKE_CASE（`MAX_RESULTS`）

### 代码格式化
- Prettier：2 空格缩进、单引号、无分号、行宽 100
- ESLint：`@typescript-eslint/recommended`
- 提交前 husky + lint-staged 自动格式化

### Conventional Commits

```
feat: 新功能
fix: 修复 bug
docs: 文档
style: 格式
refactor: 重构
perf: 性能优化
test: 测试
chore: 构建/工具
```

格式：`<type>(<scope>): <subject>`
示例：`feat(provider): add pansou api integration`

## 提交 PR

1. Fork 仓库
2. 创建功能分支：`git checkout -b feature/your-feature`
3. 编写代码，确保：
   - 通过 lint：`pnpm lint`
   - 通过测试：`pnpm test`
   - 覆盖率达标（核心模块 70%+）
4. 提交：`git commit -m "feat(xxx): 描述"`
5. 推送：`git push origin feature/your-feature`
6. 创建 PR，描述：
   - 改了什么
   - 为什么改
   - 如何测试

## 报告 Bug

使用 [Bug Report 模板](https://github.com/donggua12339/seekall/issues/new?template=bug_report.md) 提交 Issue，包含：
- 复现步骤
- 期望行为
- 实际行为
- 环境信息（浏览器/Node 版本等）

## 功能建议

使用 [Feature Request 模板](https://github.com/donggua12339/seekall/issues/new?template=feature_request.md) 提交，说明：
- 使用场景
- 期望的功能
- 是否有替代方案

## 合规红线（不可逾越）

以下 PR 将被拒绝：

- 会员分级过滤（付费用户过滤更宽松）
- 会员专属资源（付费用户可见更多侵权资源）
- 任何"付费换侵权资源访问权"机制
- 存储文件内容（仅允许存链接 + 元数据）
- 破坏避风港原则的 takedown 流程变更

## 开源协议

贡献的代码将遵循 [AGPL-3.0](./LICENSE) 协议。提交 PR 即表示同意以该协议开源你的贡献。
