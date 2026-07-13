# 觅源 SeekAll

> 觅寻全网资源，一站即达

觅源 SeekAll 是一款全网资源聚合搜索引擎，支持网盘、磁力、TG 频道等多源搜索，提供一站式资源发现体验。

## 特性

- **多源聚合**：一次搜索，并发检索多个数据源（网盘 / 磁力 / TG 频道 / 资源论坛）
- **插件化 Provider 架构**：数据源热插拔，新增源不影响主流程
- **邀请码注册**：邀请码控制注册范围，可对接 WM 发卡网销售
- **会员激活码**：非功能性付费特权（徽章、搜索历史容量扩大），合规合法
- **完整合规框架**：免责声明、用户协议、侵权举报 takedown 流程、关键词黑名单
- **失效链接检测**：BullMQ 定时任务，自动检测并过滤失效链接
- **现代化技术栈**：NestJS + Nuxt 3 SSR + Prisma + MySQL + Redis + Meilisearch
- **一键部署**：Docker Compose 单机部署，Caddy 自动 HTTPS

## 技术栈

| 层       | 选型                                            |
| -------- | ----------------------------------------------- |
| 前端     | Nuxt 3 + TypeScript + Naive UI + UnoCSS + Pinia |
| 后端     | NestJS + Fastify + TypeScript + Prisma          |
| 数据库   | MySQL 8 + Redis 7                               |
| 全文检索 | Meilisearch                                     |
| 任务队列 | BullMQ                                          |
| 邮件     | Resend + QQ 邮箱 SMTP                           |
| 反向代理 | Caddy                                           |
| 容器化   | Docker Compose                                  |
| 开源协议 | AGPL-3.0                                        |

## 快速开始

### 环境要求

- Node.js >= 20
- pnpm >= 9
- Docker + Docker Compose
- MySQL 8（或使用 Docker）
- Redis 7（或使用 Docker）

### 安装

```bash
# 克隆仓库
git clone <repo-url>
cd seekall

# 安装依赖
pnpm install

# 复制环境变量模板
cp .env.example .env
# 编辑 .env 填写实际配置

# 生成 Prisma Client
pnpm --filter api prisma:generate

# 执行数据库迁移
pnpm --filter api prisma:migrate

# 初始化用户协议
pnpm --filter api prisma:seed

# 创建超级管理员
pnpm --filter api cli:setup-admin <username> <email> <password>

# 启动开发服务
pnpm dev
```

### Docker 部署

```bash
# 复制环境变量
cp .env.example .env
# 编辑 .env 填写生产配置

# 启动
cd docker
docker compose up -d --build

# 创建超级管理员（首次部署）
docker compose exec seekall-api node dist/cli/setup-admin.js <username> <email> <password>
```

## 目录结构

```
seekall/
├── apps/
│   ├── api/                      # NestJS 后端
│   └── web/                      # Nuxt 3 前端
├── docker/                       # Docker Compose 与配置
├── docs/                         # 文档
├── CLAUDE.md                     # AI 助手工作规范
├── ARCHITECTURE.md               # 架构设计
├── CHANGELOG.md                  # 变更日志
├── LICENSE                       # AGPL-3.0
└── package.json                  # monorepo 根配置
```

详见 [CLAUDE.md](./CLAUDE.md) 和 [ARCHITECTURE.md](./ARCHITECTURE.md)。

## 开发命令

```bash
pnpm dev                # 启动前后端开发服务
pnpm build              # 构建生产版本
pnpm lint               # Lint
pnpm test               # 测试
pnpm format             # 格式化
pnpm --filter api prisma:studio  # Prisma Studio
```

## 合规声明

- 本站仅提供链接聚合服务，不存储任何文件内容
- 所有用户资源访问范围一致，无会员分级过滤
- 完整 takedown 流程，24 小时内响应侵权举报
- 仅作私人小圈子使用，不公开宣传

如发现侵权内容，请通过站点的"侵权举报"页面提交下架请求。

## 开源协议

本项目基于 [AGPL-3.0](./LICENSE) 协议开源。

任何使用本项目代码提供网络服务的行为，必须同样开源。禁止商业闭源使用。

## 相关项目

- [PanSou](https://github.com/fish2018/pansou) - 高性能网盘搜索 API
- [PanHub](https://github.com/joyce677/panhub) - 全网最全的网盘搜索
- [magnetico](https://github.com/boramalper/magnetico) - 自治 DHT 爬虫
- [bitmagnet](https://bitmagnet.io) - 自托管 BitTorrent 索引
