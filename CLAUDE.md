# CLAUDE.md - 觅源 SeekAll 项目宪章

> 本文档是 SeekAll 项目的强制约束规范，所有代码必须遵守。AI 助手在协助开发时必须遵循本宪章。

## 项目简介

- **中文名**：觅源
- **英文名**：SeekAll
- **类型**：全网资源聚合搜索引擎（网盘 / 磁力 / TG 频道 / 资源论坛）
- **定位**：Z++ 方案 - 小圈子共享（50 人以内），邀请码注册，不公开宣传
- **开源协议**：AGPL-3.0
- **域名**：`seekall.winmelon.cn` + `admin.seekall.winmelon.cn`

## 法律合规边界（红线，不可逾越）

1. **只存链接 + 元数据**，绝不存储文件内容
2. **所有用户资源访问范围一致**，无会员分级过滤
3. **付费用户特权仅限非功能性**：徽章、搜索历史容量扩大、API 额度（v0.2）、去广告（v0.2）
4. **完整 takedown 流程**：24h 内响应，记录到 `takedown_records` 表
5. **统一关键词过滤**，所有用户一致
6. **免责声明 + 用户协议**：注册强制勾选 + 页脚常驻
7. **SeekAll 与 WM 发卡网法律隔离**：WM 只销售注册邀请码

**禁止实现的功能**：

- 会员分级过滤（付费用户过滤更宽松）
- 会员专属资源（付费用户可见更多侵权资源）
- 任何"付费换侵权资源访问权"机制

## 技术栈

| 层       | 选型                                            |
| -------- | ----------------------------------------------- |
| 前端     | Nuxt 3 + TypeScript + Naive UI + UnoCSS + Pinia |
| 后端     | NestJS + Fastify + TypeScript + Prisma          |
| 数据库   | MySQL 8 + Redis 7                               |
| 全文检索 | Meilisearch                                     |
| 任务队列 | BullMQ                                          |
| 邮件     | Resend（主）+ QQ 邮箱 SMTP（备）                |
| 反向代理 | Caddy                                           |
| 容器化   | Docker Compose 单机                             |
| API 文档 | Swagger（prod 关闭）                            |
| 认证     | JWT Access (15m) + Refresh (7d) + argon2        |
| monorepo | pnpm workspace                                  |

## 目录结构

```
seekall/
├── apps/
│   ├── api/                      # NestJS 后端
│   │   ├── src/
│   │   │   ├── common/           # 公共（装饰器、过滤器、守卫、拦截器、管道、工具）
│   │   │   ├── config/           # 配置
│   │   │   ├── database/         # Prisma client
│   │   │   ├── modules/          # 业务模块
│   │   │   │   ├── auth/
│   │   │   │   ├── user/
│   │   │   │   ├── invite-code/
│   │   │   │   ├── membership-code/
│   │   │   │   ├── search/
│   │   │   │   ├── provider/
│   │   │   │   │   ├── interfaces/
│   │   │   │   │   └── providers/
│   │   │   │   ├── search-history/
│   │   │   │   ├── favorite/
│   │   │   │   ├── takedown/
│   │   │   │   ├── blocked-keyword/
│   │   │   │   ├── link-checker/
│   │   │   │   ├── admin/
│   │   │   │   ├── agreement/
│   │   │   │   └── health/
│   │   │   └── workers/          # BullMQ worker
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── test/
│   │   ├── Dockerfile
│   │   ├── nest-cli.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                      # Nuxt 3 前端
│       ├── pages/
│       ├── components/
│       ├── composables/
│       ├── stores/
│       ├── plugins/
│       ├── middleware/
│       ├── assets/
│       ├── public/
│       ├── app.vue
│       ├── nuxt.config.ts
│       ├── Dockerfile
│       ├── package.json
│       └── tsconfig.json
├── docker/
│   ├── docker-compose.yml
│   ├── caddy/Caddyfile
│   ├── mysql/init.sql
│   └── ...
├── docs/
├── .env.example
├── .gitignore
├── CLAUDE.md
├── ARCHITECTURE.md
├── README.md
├── CHANGELOG.md
├── LICENSE
├── pnpm-workspace.yaml
└── package.json
```

## 编码规范

### TypeScript

- `strict: true`，禁用 `any`
- 优先 `interface`，类型推导不足时用 `type`
- 显式标注返回类型

### 命名约定

| 类型       | 约定                      | 示例                     |
| ---------- | ------------------------- | ------------------------ |
| 文件名     | kebab-case                | `invite-code.service.ts` |
| 类名       | PascalCase                | `InviteCodeService`      |
| 接口名     | PascalCase（不加 I 前缀） | `Provider`               |
| 函数/变量  | camelCase                 | `searchAll`              |
| 常量       | UPPER_SNAKE_CASE          | `MAX_RESULTS`            |
| 数据库表   | snake_case 复数           | `invite_codes`           |
| 数据库字段 | snake_case                | `created_at`             |
| API 路径   | kebab-case 复数           | `/api/v1/invite-codes`   |
| 环境变量   | UPPER_SNAKE_CASE          | `DATABASE_URL`           |

### 代码格式化

- Prettier：2 空格缩进、单引号、无分号、行宽 100
- ESLint：`@typescript-eslint/recommended`

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
ci: CI 配置
```

格式：`<type>(<scope>): <subject>`
示例：`feat(provider): add pansou api integration`

## 架构原则

### 分层架构

```
Controller (路由 + 参数校验)
    ↓
Service (业务逻辑)
    ↓
Repository (数据访问，Prisma 封装)
    ↓
Database
```

- Controller 不写业务逻辑
- Service 不直接操作 HTTP 上下文
- Repository 封装 Prisma

### 依赖注入

- 所有 Service 通过 DI 注入
- Provider 通过 `@Inject(PROVIDER_TOKEN)` 注入
- 禁止 `new` 创建依赖

### 接口防腐层 (ACL)

- 外部 API 调用必须封装在 Provider 内
- 外部数据格式不能泄漏到 Service 层

### 错误隔离

- Provider 异常不传播到主流程
- 单源失败 -> 降级返回空结果 + 日志告警

### 限流降级

- 单 Provider 超时 10s（PanSou API 响应慢，5s 不够）
- 全局搜索超时 15s
- Provider 多 URL 故障转移 + 重试（最多 2 次，间隔 1s）
- Redis 缓存热门查询 1h（v0.2 分级 TTL：热门 1h / 长尾 10min / 空结果 30s）
- 空结果不缓存（避免失败被缓存，v0.2 改为短缓存防穿透）
- 慢查询降级返回缓存或空结果

## API 设计规范

### RESTful

- 资源用复数名词：`/api/v1/users`
- CRUD：GET / POST / PATCH / DELETE

### 统一响应格式

```typescript
// 成功
{ "code": 0, "data": { ... }, "message": "ok" }

// 失败
{ "code": 40001, "data": null, "message": "邀请码无效" }
```

### 错误码体系

```
0       - 成功
1xxxx   - 通用错误（10001 参数错误、10002 未授权、10003 禁止访问）
2xxxx   - 认证错误（20001 邀请码无效、20002 密码错误、20003 Token 过期、20004 邮箱未验证）
3xxxx   - 资源错误（30001 资源不存在、30002 资源已下架）
4xxxx   - 搜索错误（40001 搜索超时、40002 无可用 Provider）
5xxxx   - 系统错误（50000 内部错误、50001 数据库错误）
```

### 分页约定

```
请求：?page=1&pageSize=20
响应：{ "list": [...], "total": 100, "page": 1, "pageSize": 20, "totalPages": 5 }
```

### 版本控制

- URL 版本：`/api/v1/...`
- 破坏性变更升版本号，旧版本保留 6 个月

## 安全规范

### 输入校验

- 所有请求用 class-validator DTO 校验
- 字符串长度、格式、范围必须显式约束

### SQL 注入

- Prisma 参数化查询，禁止 raw SQL 拼接

### XSS 防护

- Vue 模板默认转义
- 存储前用 `sanitize-html` 净化 HTML 内容

### 速率限制

- 全局：每 IP 100 次/分钟
- 搜索：每用户 30 次/分钟
- 登录：每 IP 5 次/分钟
- 注册：每 IP 3 次/小时
- 密码重置：每 IP 3 次/小时

### 敏感数据

- 密码用 argon2 哈希
- JWT Secret 从环境变量读取
- `.env` 不进 Git
- 邀请码与 WM 订单号绑定，可追溯

## 测试规范

### 工具

- Jest（NestJS 默认）

### 分层

- 单元测试：Service 层（mock Repository）、Provider 层（mock 外部 API）
- 集成测试：Controller + Service + Repository（用真实 MySQL test 库）
- E2E 测试：v0.2

### 覆盖率

- 核心模块 70%+

## Git 工作流

### 分支策略

- `main`：生产分支，受保护
- `develop`：开发主分支
- `feature/xxx`：功能分支
- `fix/xxx`：修复分支
- `release/x.x.x`：发布分支

### 预提交钩子

- husky + lint-staged
- 提交前自动 lint + format
- commitlint 校验提交信息格式

## Provider 开发规范

### 必须实现接口

```typescript
interface Provider {
  readonly name: string;
  readonly displayName: string;
  readonly category: "netdisk" | "magnet" | "tg" | "forum";
  search(query: SearchQuery): Promise<SearchResult[]>;
  healthCheck(): Promise<boolean>;
}
```

### 必须处理

- 超时（5s）
- 错误降级（返回空数组）
- 限流（自身被源站限流时退避）

### 不允许

- 直接抛错到主流程
- 修改全局状态
- 依赖其他 Provider

## 开发命令

```bash
# 安装依赖
pnpm install

# 启动开发环境（前后端并行）
pnpm dev

# 构建
pnpm build

# Lint
pnpm lint

# 测试
pnpm test

# 格式化
pnpm format

# Prisma
pnpm --filter api prisma:migrate
pnpm --filter api prisma:generate
pnpm --filter api prisma:studio

# Docker 部署
cd docker
docker compose up -d
```

## 部署流程

1. 拉取最新代码到香港服务器
2. `cp .env.example .env` 并填写生产配置
3. `cd docker && docker compose up -d --build`
4. Prisma 自动执行 `migrate deploy`
5. 创建超级管理员账户（首次部署）：`pnpm --filter api cli:setup-admin`
6. Caddy 自动申请 HTTPS 证书
7. 验证 `https://seekall.winmelon.cn/api/v1/health`

## 数据保留策略

| 数据            | 保留    | 清理方式              |
| --------------- | ------- | --------------------- |
| 用户数据        | 永久    | 软删除 `deleted_at`   |
| 搜索历史        | 永久    | 用户手动 / 管理员清理 |
| 搜索日志        | 90 天   | 定时任务              |
| 收藏夹          | 永久    | 用户手动              |
| takedown 记录   | 永久    | 不清理（合规证据）    |
| 邮件/重置 token | 30 分钟 | 过期自动清理          |
| Redis 缓存      | 1 小时  | TTL 自动              |
| 管理员审计日志  | 1 年    | 定时任务              |

## 失效链接检测

- BullMQ 定时任务，每天 3:00 执行
- HEAD 请求，超时 5s，并发 10
- 状态：`unknown` / `active` / `dead` / `checking`
- 搜索结果过滤 `dead` 链接
- 用户可手动举报失效

## 版本号约定（SemVer）

- **v0.1.0** - MVP（已完成 2026-07-13）
- **v0.2.0** - 稳定加固 + 功能扩展（已完成 2026-07-13）
- **v0.3.0** - 运营准备（已完成 2026-07-13）
- **v0.3.1** - 体验优化（已完成 2026-07-14）
- **v0.3.2** - 资源管理+运营（已完成 2026-07-14）
- **v0.3.3** - 生态扩展（已完成 2026-07-14）
- **v0.4.0** - Provider 扩展（已完成 2026-07-14）
- **v0.4.1** - 高级功能（已完成 2026-07-14）
- **v1.0.0** - 正式发布（等正式运营 + 开源公开后）

## 当前阶段

**v0.4.1 已完成** - 等待正式运营部署

### v0.4.1 高级功能（已完成 2026-07-14）

- [x] AI 资源标签（基于标题规则匹配自动分类）
- [x] AI 资源推荐（基于搜索历史 + Meilisearch 相似度）
- [x] 关键词订阅 + 邮件通知（每 2 小时检查）
- [x] 资源有效性投票（群体智慧维护）
- [x] 字幕搜索（对接 OpenSubtitles API）
- [x] 字幕配置教程（docs/SUBTITLE-GUIDE.md）
- [x] 下载队列（对接 aria2 JSON-RPC）
- [x] 资源合集（主题合集 + 资源管理）
- [x] PWA 支持（manifest + theme-color）
- [x] 搜索历史时间线（日期分组时间轴）
- [x] 资源封面图墙（Netflix 风格 grid）
- [x] Provider 自动降级（健康度 < 30 禁用，> 70 恢复）
- [x] 快捷键帮助面板 + 主题切换按钮

### v0.4.0 Provider 扩展（已完成 2026-07-14）

- [x] TG 频道直连（独立 tg-collector 服务）
- [x] 资源论坛 Provider（通用框架）
- [x] DHT 自爬（独立 dht-crawler 服务）
- [x] 夸克网盘转存（完整 API 逆向）
- [x] 自定义 Provider 插件文档

### v0.3.3 生态扩展（已完成 2026-07-14）

- [x] API Key 权限细分（scopes）
- [x] Telegram Bot
- [x] 浏览器插件

### v0.3.2 资源管理+运营（已完成 2026-07-14）

- [x] 资源详情页 + 分享卡片
- [x] 登录设备管理
- [x] Provider 健康度评分
- [x] 用户行为分析面板

### v0.3.1 体验优化（已完成 2026-07-14）

- [x] 搜索建议/过滤/排序/快捷键/收藏夹分组

### v0.3.0 运营准备（已完成 2026-07-13）

- [x] 部署脚本 + 生产配置 + 部署文档
- [x] 开源文档（README/CONTRIBUTING/Issue模板）
- [x] Sentry 监控配置

### v0.2.0 稳定加固 + 功能扩展（已完成 2026-07-13）

- [x] 性能优化（缓存分级 TTL + Provider 流式返回）
- [x] GitHub OAuth 登录
- [x] API 开放（API Key 鉴权 + 限流）
- [x] husky/eslint 修复 + Prisma 迁移 + 测试覆盖率达标

### v0.1.0 MVP（已完成 2026-07-13）

- [x] 11 项必做 + 9 项超额（TG频道/模糊搜索/Sentry等）

### 待运营部署

- 部署到香港服务器（裸机 + PM2 + Caddy）
- 域名 HTTPS（seekall.winmelon.cn）
- Resend 域名验证
- UptimeRobot 监控接入
- 开源公开（GitHub 仓库转 public）

## 版本历史（CHANGELOG 摘要）

### v0.4.1（2026-07-14）- 高级功能
AI 标签/推荐、关键词订阅通知、有效性投票、字幕搜索+教程、下载队列、资源合集、PWA、时间线、图墙、Provider 自动降级

### v0.4.0（2026-07-14）- Provider 扩展
TG 直连、资源论坛、DHT 自爬、夸克转存

### v0.3.3（2026-07-14）- 生态扩展
API Key 权限、TG Bot、浏览器插件

### v0.3.2（2026-07-14）- 资源管理+运营
详情页、分享卡片、设备管理、健康度、分析面板

### v0.3.1（2026-07-14）- 体验优化
搜索建议/过滤/排序/快捷键/收藏夹分组

### v0.3.0（2026-07-13）- 运营准备
部署脚本、生产配置、开源文档、Sentry

### v0.2.0（2026-07-13）- 稳定加固 + 功能扩展
性能优化、GitHub OAuth、API 开放、技术债务清理

### v0.1.0（2026-07-13）- MVP
11 项必做 + 9 项超额
