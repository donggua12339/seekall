# 觅源 SeekAll 项目规约

> 版本：1.0.0 | 适用版本：v0.5+ | 最后更新：2026-07-28
>
> 本文件是 SeekAll 项目的**强制规约**，所有代码、PR、部署必须遵守。AI 助手协助开发时同样受本规约约束。

---

## 1. 总则

### 1.1 项目定位

SeekAll 是**中立的搜索规则引擎 SDK + 规则市场 + BaaS**，不是搜索网站。

- SDK（`@seekall/sdk`）：用户本机执行搜索，服务端零接触搜索内容
- 规则市场：社区贡献规则（npm 包），5 级风险评级
- BaaS：账号 / 规则订阅 / 付费授权 / DMCA 合规

### 1.2 协议

- SDK 核心：AGPL-3.0
- 规则插件：MIT

### 1.3 语言

- 代码注释：中文或英文均可，保持文件内一致
- 文档 / commit message / 用户可见文案：中文
- 变量名 / 函数名 / 文件名：英文

---

## 2. 编码规范

### 2.1 TypeScript

- 严格模式：`strict: true`
- 禁止 `any`：ESLint `@typescript-eslint/no-explicit-any` 强制开启
- 优先使用 `interface` 而非 `type`（除非需要联合类型 / 映射类型）
- 不使用 `enum`（前端），后端 Prisma 生成的 enum 除外

### 2.2 命名约定

| 对象                       | 风格                    | 示例                                |
| -------------------------- | ----------------------- | ----------------------------------- |
| 文件名                     | kebab-case              | `rule.service.ts`、`MyLicenses.vue` |
| 类名                       | PascalCase              | `RuleService`、`SearchController`   |
| 函数 / 方法                | camelCase               | `handleSubmit`、`loadRules`         |
| 常量                       | UPPER_SNAKE_CASE        | `RULE_TIMEOUT`、`BASE_RULES`        |
| 接口                       | PascalCase，无 `I` 前缀 | `SearchResult`、`RuleContext`       |
| Vue 组件文件               | PascalCase              | `Market.vue`、`Dashboard.vue`       |
| CSS 类名                   | kebab-case              | `.search-input`、`.result-card`     |
| 数据库表名                 | snake_case 复数         | `users`、`rule_subscriptions`       |
| 数据库字段（Prisma model） | camelCase               | `npmPackage`、`riskLevel`           |
| 数据库字段（物理列名）     | snake_case              | `npm_package`、`risk_level`         |

### 2.3 目录结构

```
seekall/
├── apps/
│   ├── api/              # NestJS 后端
│   │   ├── src/
│   │   │   ├── common/   # 公共层（decorators / filters / guards / interceptors / utils）
│   │   │   ├── config/   # 环境变量校验
│   │   │   ├── database/ # Prisma + Redis service
│   │   │   └── modules/  # 业务模块（每个模块一个目录）
│   │   │       └── xxx/
│   │   │           ├── xxx.module.ts
│   │   │           ├── xxx.controller.ts
│   │   │           ├── xxx.service.ts
│   │   │           ├── xxx.service.spec.ts
│   │   │           └── dto/          # DTO 定义
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── seed.ts
│   ├── admin/            # Vue 3 Admin SPA
│   ├── user-spa/         # Vue 3 用户中心 SPA
│   └── docs-site/        # VitePress 静态文档站
├── packages/
│   ├── sdk/              # @seekall/sdk 核心
│   ├── rule-xxx/         # 规则包（每个一个目录）
│   └── proxy-pool/       # 代理池工具包
├── docker/               # Docker Compose + 配置
├── scripts/              # 运维脚本
└── docs/                 # 项目文档
```

### 2.4 模块规范（后端）

每个业务模块必须包含：

- `xxx.module.ts` — NestJS Module 定义
- `xxx.controller.ts` — 路由 + DTO 校验
- `xxx.service.ts` — 业务逻辑
- `xxx.service.spec.ts` — 单元测试（可选但推荐）
- `dto/index.ts` — 请求 / 响应 DTO（class-validator 装饰器）

模块间**禁止直接引用**其他模块的 Service，必须通过 Module exports 或事件通信。

### 2.5 模块规范（前端）

- 页面组件放 `views/` 目录，按功能子目录组织
- 可复用组件放 `components/`
- API 调用封装放 `api/`，每个后端模块一个文件
- 状态管理放 `stores/`，使用 Pinia Composition API 风格
- 路由定义集中在 `router/index.ts`

---

## 3. API 规范

### 3.1 路径约定

```
/api/v1/{module}/{resource}[/{id}][/{action}]
```

- 版本前缀：`/api/v1/`
- 模块名：小写复数（`rules`、`licenses`、`users`）
- Admin 路由：`/api/v1/admin/{module}/...`
- 公开路由：不加前缀区分，用 `@Public()` 装饰器标记

### 3.2 HTTP 方法

| 方法   | 用途        | 示例                                       |
| ------ | ----------- | ------------------------------------------ |
| GET    | 查询        | `GET /rules`、`GET /rules/:id`             |
| POST   | 创建 / 动作 | `POST /rules`、`POST /rules/:id/subscribe` |
| PATCH  | 部分更新    | `PATCH /admin/users/:id/badge`             |
| DELETE | 删除 / 取消 | `DELETE /rules/:id/subscribe`              |

**禁止**在 GET 请求中修改数据。**禁止**用 POST 做查询（搜索除外，因为查询参数可能很长）。

### 3.3 响应格式

所有 API 响应必须遵循统一格式，由 `ResponseInterceptor` 自动包装：

```json
// 成功
{ "code": 0, "data": { ... }, "message": "ok" }

// 失败
{ "code": 10001, "data": null, "message": "参数错误" }
```

**例外**：`BusinessException` 和 `HttpException` 由 `HttpExceptionFilter` 处理，同样返回上述格式。

### 3.4 错误码体系

5 位数字，按模块分段：

| 范围    | 模块 | 示例                                                       |
| ------- | ---- | ---------------------------------------------------------- |
| `0`     | 成功 | `0`                                                        |
| `1xxxx` | 通用 | `10001` 参数错误、`10002` 未授权、`10006` 限流             |
| `2xxxx` | 认证 | `20004` 用户名已存在、`20007` 密码错误、`20010` 邮箱未验证 |
| `3xxxx` | 资源 | `30001` 资源不存在                                         |
| `4xxxx` | 搜索 | `40001` 搜索超时                                           |
| `5xxxx` | 系统 | `50001` 数据库错误、`50003` 邮件发送失败                   |

新增错误码必须在 `apps/api/src/common/constants/error-codes.ts` 注册，同步更新 `errorMessageMap`。

### 3.5 DTO 校验

- 所有请求体必须定义 DTO 类，使用 `class-validator` 装饰器
- 启用 `whitelist: true` + `forbidNonWhitelisted: true`（全局 ValidationPipe）
- 字符串字段必须加 `@IsString()`
- 数字字段必须加 `@IsNumber()`（不能用 `@IsInt()` 代替，除非确定是整数）
- 可选字段加 `@IsOptional()`
- 枚举字段用 `@IsIn([...])` 而非 `@IsEnum()`（避免 Prisma enum 序列化问题）

### 3.6 限流

- 全局默认：100 次/分钟（`ThrottlerModule.forRoot`）
- 认证端点（login / register / password-reset）：3-5 次/分钟
- 搜索端点：20 次/分钟
- 使用 `@Throttle()` 装饰器覆盖默认值

### 3.7 认证

- Access Token：JWT，15 分钟有效期
- Refresh Token：JWT，7 天有效期，Redis 白名单
- 密码哈希：argon2
- 公开端点：`@Public()` 装饰器豁免 JWT 校验
- 公开端点**软认证**：如果请求带了合法 token，也解析 `@CurrentUser`，让可选用户信息可用

---

## 4. 数据库规范

### 4.1 ORM

- 使用 Prisma 5.22+
- 禁止在 Service 层写 raw SQL（除非 Prisma 无法表达，如 `groupBy` 类型问题）
- 所有查询通过 `PrismaService` 注入

### 4.2 命名

- 表名：snake_case 复数，通过 `@@map("xxx")` 映射
- 字段名：Prisma model 用 camelCase，物理列用 `@map("snake_case")`
- 外键字段：`{relation}Id`（如 `authorId`），物理列 `{relation}_id`
- 索引名：Prisma 自动生成，不需要手动命名

### 4.3 主键

- 统一使用 `BigInt @id @default(autoincrement()) @db.UnsignedBigInt`
- API 层返回时 `toString()` 转为字符串（JSON 不支持 BigInt）

### 4.4 时间字段

- 创建时间：`createdAt DateTime @default(now()) @map("created_at")`
- 更新时间：`updatedAt DateTime @updatedAt @map("updated_at")`
- 软删除：`deletedAt DateTime? @map("deleted_at")` 或 `status` 枚举（视业务需要）

### 4.5 索引

- 外键字段必须加 `@@index`
- `status` / `tier` 等常用过滤字段必须加 `@@index`
- 唯一约束用 `@@unique([field1, field2])`

### 4.6 迁移

- 开发环境：`npx prisma migrate dev`
- 生产环境：手动 SQL 脚本（放 `scripts/sql/`），通过 `docker exec` 执行
- 禁止在生产环境跑 `prisma migrate deploy`（避免锁表风险）

---

## 5. 前端规范

### 5.1 技术栈

- 框架：Vue 3 + `<script setup lang="ts">`
- UI 库：Naive UI
- 状态管理：Pinia（Composition API 风格）
- 路由：Vue Router 4（history mode）
- 样式：Scoped CSS（不用 CSS Modules / Tailwind / UnoCSS）
- HTTP：Axios + 响应拦截器

### 5.2 组件规范

- 单文件组件（SFC），`<script setup>` 在前
- Props 用 `defineProps<T>()` 泛型形式
- Emits 用 `defineEmits<T>()` 泛型形式
- 模板中不使用复杂表达式，提取到 computed

### 5.3 状态管理

- 每个 store 一个文件，放 `stores/` 目录
- 使用 `defineStore('name', () => { ... })` Composition API 风格
- Token 持久化到 localStorage（key 前缀 `sa_` 区分 admin / user-spa）
- 禁止在 store 外直接操作 localStorage

### 5.4 API 层

- 每个后端模块一个 API 文件（`api/auth.ts`、`api/rule.ts` 等）
- 导出接口类型 + API 函数对象
- 使用统一的 axios instance（`api/instance.ts`）
- 响应拦截器自动解包 `body.data`（当 `body.code === 0` 时）

### 5.5 路由守卫

- 公开页面：`meta: { public: true }`
- 需要登录：无 `public` meta，守卫检查 `auth.isLoggedIn`
- Admin 页面：后端 `@Roles('super_admin')` 保护，前端不做角色拦截（避免 token 刷新时序问题）

---

## 6. SDK 规范

### 6.1 Rule 接口

```typescript
interface Rule {
  name: string; // npm 包名，如 @seekall/rule-arxiv
  version: string; // semver
  riskLevel: 0 | 1 | 2 | 3 | 4;
  description: string;
  run(query: string, ctx: RuleContext): Promise<Hit[]>;
}
```

### 6.2 规则包结构

```
packages/rule-xxx/
├── src/
│   └── index.ts        # 导出 Rule 对象（named + default）
├── package.json         # name: @seekall/rule-xxx
├── tsconfig.json
└── tsup.config.ts       # ESM 输出
```

### 6.3 发布规范

- 包名：`@seekall/rule-{name}`
- 版本：与 SDK 主版本对齐（0.5.x）
- 发布前：`pnpm build` + 本地 `node dist/index.js` 验证
- 发布命令：`npm publish --access public`

---

## 7. 测试规范

### 7.1 单元测试

- 框架：Jest
- 位置：与源文件同目录，`xxx.service.spec.ts`
- Mock：Prisma 用 `jest.fn()` mock，不连真实数据库
- 覆盖要求：Service 层核心逻辑必须有测试

### 7.2 测试命名

```typescript
describe('模块名', () => {
  describe('方法名', () => {
    it('场景描述 → 期望结果', async () => { ... })
  })
})
```

### 7.3 e2e 测试

- 脚本：`scripts/e2e-v0.5-smoke.mjs`
- 覆盖：SDK 冷启动 + 合规 grep（13 个禁止模式）
- 运行：`node scripts/e2e-v0.5-smoke.mjs --skip-server`

---

## 8. 安全规范

### 8.1 五条红线（不可逾越）

1. SDK 默认包**不塞任何指向具体网盘 / 磁力 / 盗版站的 Rule**（可带 L0 学术规则）
2. L3/L4 规则**永远不对非 admin 可见**（即使付费）
3. **不做评论 / 评分 / 论坛功能**（避免 UGC 内容责任）
4. `apps/api/src/modules/rule/` 里**不出现** `axios` / `fetch` / `http`（服务端不调资源站）
5. **不集成支付 SDK**（用 WM 卡 SKU + webhook）

### 8.2 敏感信息

- 禁止入库：密码 / Token / Secret / API Key
- 环境变量：`.env` 文件（已 gitignore）
- 服务器 `.env`：通过 `docker run --rm -v` 写入，不通过 SSH echo

### 8.3 输入校验

- 所有外部输入必须经过 DTO 校验（class-validator）
- SQL 注入：Prisma 参数化查询，禁止字符串拼接
- XSS：前端 Vue 模板自动转义，`v-html` 禁用（除非内容已 sanitize）

### 8.4 认证与授权

- JWT 签名密钥：环境变量，长度 ≥ 32 字符
- Refresh Token 白名单：Redis Set，支持多设备
- 密码重置 Token：30 分钟有效，一次性使用
- 邮箱验证 Token：30 分钟有效

---

## 9. 部署规范

### 9.1 容器化

- 7 个 Docker 容器：api / admin / user-spa / docs-site / mysql / redis / meilisearch
- 固定 IP 分配（nginx 反代依赖）：
  - api: 172.18.0.5
  - docs-site: 172.18.0.6
  - admin: 172.18.0.7
  - user-spa: 172.18.0.9
- 镜像：`node:20-alpine`（builder + runner 两阶段构建）
- Alpine 注意：Prisma 需要 `apk add --no-cache openssl`

### 9.2 反向代理

- 主机 nginx（雨云 apt 安装，版本 1.18）
- 每个子域名一个 vhost 文件：`/etc/nginx/sites-enabled/{domain}`
- HTTPS：Let's Encrypt 通配符证书 `*.winmelon.cn`
- API 反代：每个前端 vhost 必须加 `location /api/ { proxy_pass http://172.18.0.5:7301; }`

### 9.3 构建

- **串行构建**：4GB 服务器并行 build 4 镜像会 OOM（load 飙到 1274）
- 构建顺序：api → user-spa → admin → docs-site
- 构建命令：`sudo docker compose build {service} && sudo docker compose build {next}`

### 9.4 部署流程

```bash
# 1. 本地 commit + push
git add -A && git commit -m "type: description" && git push origin master

# 2. 服务器拉取
cd ~/seekall && GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519_seekall_deploy -o IdentitiesOnly=yes" git pull origin master

# 3. 同步到 /opt
sudo docker run --rm -v /opt:/opt -v /home/donggua-seekall:/home alpine:3.18 sh -c "cp -a /home/seekall/. /opt/seekall-v0.5/ && chown -R root:root /opt/seekall-v0.5"

# 4. 串行构建 + 重启
cd /opt/seekall-v0.5/docker
sudo docker compose build seekall-api && sudo docker compose up -d --no-deps seekall-api

# 5. 验证
curl -s http://172.18.0.5:7301/api/v1/health
```

### 9.5 回滚

- 保留上一个 Docker image（不 prune）
- 回滚命令：`sudo docker compose up -d --no-deps {service}` （使用旧 image）
- 数据库回滚：从 `/opt/seekall-v0.5/backups/` 恢复（每日 3 点 cron 备份）

---

## 10. Git 规范

### 10.1 分支

- 主分支：`master`
- 功能分支：`feat/{description}`
- 修复分支：`fix/{description}`
- 禁止直接 push 到 master（当前单人开发例外）

### 10.2 Commit Message

格式：Conventional Commits（commitlint 强制）

```
type(scope): subject

body（可选）
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
| `ci`       | CI/CD              |

规则：

- subject 必须小写开头
- subject 不超过 100 字符
- footer 行宽不超过 100 字符

### 10.3 Pre-commit Hook

- husky 9 + lint-staged 15
- `*.{ts,tsx}`：eslint --fix + prettier --write
- `*.{vue,js,cjs}`：eslint --fix + prettier --write
- `*.{json,md,css,scss}`：prettier --write
- 排除目录：`apps/admin/`、`apps/user-spa/`、`apps/docs-site/`、`packages/`（各自工具链）

---

## 11. 文档规范

### 11.1 必备文档

| 文件              | 内容                | 更新频率   |
| ----------------- | ------------------- | ---------- |
| `README.md`       | 项目介绍 + 快速开始 | 每个大版本 |
| `CLAUDE.md`       | AI 助手项目宪章     | 架构变更时 |
| `spec.md`         | 本文件，项目规约    | 规范变更时 |
| `plan.md`         | 项目路线图          | 每个里程碑 |
| `tasks.md`        | 任务清单            | 持续更新   |
| `CHANGELOG.md`    | 变更日志            | 每次发版   |
| `CONTRIBUTING.md` | 贡献指南            | 流程变更时 |
| `ARCHITECTURE.md` | 架构设计            | 架构变更时 |

### 11.2 文档语言

- 所有面向用户的文档：中文
- 代码注释：中文或英文
- commit message：英文 type + 中文 subject 均可
