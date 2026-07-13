# 觅源 SeekAll

> 觅寻全网资源，一站即达
>
> SeekAll is a full-web resource aggregation search engine supporting multi-source concurrent search (netdisk / magnet / TG channels), with invite-code registration and complete compliance framework.

觅源 SeekAll 是一款全网资源聚合搜索引擎，支持网盘、磁力、TG 频道等多源搜索，提供一站式资源发现体验。采用 Z++ 小圈子方案，邀请码注册，完整合规框架。

## 特性

- **多源聚合**：一次搜索，并发检索多个数据源（PanSou + TG 频道 + 磁力站 + 夸克网盘）
- **模糊搜索**：Meilisearch 本地索引，支持拼音 / 分词 / 容错，B站风格搜索体验
- **组合搜索**：实时聚合 + 索引匹配合并去重，召回率最高
- **热门搜索预热**：每小时统计 top 20 关键词预缓存，热门搜索 0ms 响应
- **插件化 Provider 架构**：数据源热插拔，多 URL 故障转移 + 重试
- **邀请码注册**：邀请码控制注册范围，可对接 WM 发卡网销售
- **会员激活码**：非功能性付费特权（徽章、搜索历史容量扩大、API 额度），合规合法
- **完整合规框架**：免责声明、用户协议、侵权举报 takedown 流程、关键词黑名单
- **失效链接检测**：BullMQ 定时任务，自动检测并过滤失效链接
- **监控告警**：Sentry 错误上报 + 健康检查告警（连续 3 次失败自动上报）
- **现代化技术栈**：NestJS + Nuxt 3 SSR + Prisma + MySQL + Redis + Meilisearch

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
| 进程管理 | PM2                                             |
| 监控     | Sentry + UptimeRobot                            |
| 开源协议 | AGPL-3.0                                        |

## 快速开始

### 本地开发

```bash
# 安装依赖
pnpm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填写本地数据库配置

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

访问 http://localhost:7300

### 生产部署

参考 [部署文档](./docs/DEPLOY.md)。

## Demo

部署后访问：https://seekall.winmelon.cn（需邀请码注册）

## 截图

> 部署后补充

- 首页（渐变背景 + 搜索框 + 热门搜索）
- 搜索结果（多源聚合 + 提取码复制 + 来源标签）
- 后台管理（用户管理 + 邀请码 + 审计日志）
- 暗黑模式

## 项目结构

```
seekall/
├── apps/
│   ├── api/          # NestJS 后端
│   └── web/          # Nuxt 3 前端
├── docker/           # Caddyfile 等部署配置
├── docs/             # 文档（部署文档等）
├── .github/          # Issue/PR 模板
├── ecosystem.config.cjs  # PM2 配置
├── deploy.sh         # 一键部署脚本
├── backup.sh         # 数据备份脚本
└── CLAUDE.md         # 项目宪章（强制约束）
```

## 合规说明

本项目采用 **Z++ 方案**：

- **只存链接 + 元数据**，绝不存储文件内容
- **所有用户资源访问范围一致**，无会员分级过滤
- **付费用户特权仅限非功能性**：徽章、搜索历史容量扩大、API 额度
- **完整 takedown 流程**：24h 内响应侵权举报
- **统一关键词过滤**，所有用户一致

详见 [CLAUDE.md](./CLAUDE.md) 的"法律合规边界"章节。

## 贡献

欢迎提交 PR 和 Issue！请先阅读 [贡献指南](./CONTRIBUTING.md)。

## 开源协议

[AGPL-3.0](./LICENSE) - 任何基于本代码的网络服务必须同样开源。
