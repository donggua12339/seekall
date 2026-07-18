# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/zh-CN/spec/v2.0.0.html).

## [0.5.0] - 2026-07-18

### 重构说明

v0.5 是一次完全重构,从「带搜索功能的 Nuxt Web 应用」转为「中立的规则引擎 SDK + 市场 + BaaS」。

**核心定位变化**:

- v0.4.1: 网盘/磁力聚合搜索网站(内置 Provider)
- v0.5: 规则引擎 SDK + 规则市场 + BaaS(默认 0 规则,工具中性合规)

### Added

- **SDK 核心** (`packages/sdk/`): `@seekall/sdk` npm 包
  - `Rule` 接口 + `createEngine` API
  - 流式回调 `onHit` / `onError` / `onDone`
  - 多源去重 + 全局超时控制
  - TypeScript 类型完备
- **3 个示例 L0 规则** (`packages/rule-arxiv` / `rule-crossref` / `rule-pubmed`)
  - arXiv: 学术论文(arxiv API)
  - Crossref: DOI 元数据
  - PubMed: 生物医学文献
- **5 张核心表 + 4 张辅助表**:
  - 核心: `users` / `licenses` / `rules` / `admin_audit_logs` / `configs`
  - 辅助: `license_claims`(防羊毛) / `rule_subscriptions`(订阅) / `rule_reviews`(评审) / `dmca_notices`(DMCA 合规)
- **5 个 API 模块 + health + dmca**:
  - `auth`: register / login / verify-email / password-reset / refresh / sessions
  - `user`: 个人资料管理
  - `admin`: dashboard / users / audit-logs / analytics / transparency-report
  - `rule`: 列表 / 提交 / 评审 / 终审 / takedown / subscribe / unsubscribe
  - `license`: generate / list / redeem / disable / invite-trial / wm-webhook
  - `dmca`: 公众提交 / admin 处理 / 透明度报告
- **5 级风险评级 (L0-L4)** + 5 维权限矩阵 (View/Run/Save/Upload/Author)
- **DMCA §512(c) 合规流程**:
  - 公众 webform 提交(`/api/v1/dmca/notice`)
  - 强制校验善意声明 + 准确性声明
  - Redis 速率限制每 IP 3 次/小时
  - Admin 处理工作流: verify -> action / reject
  - 透明度报告 API(`GET /api/v1/dmca/transparency`)
  - Takedown 累计 3 次自动封禁作者 + 下架所有规则
- **WM 发卡网半自动同步**:
  - HMAC-SHA256 webhook 签名验证
  - 幂等检查(同订单号不重复发码)
  - 支持 trial / monthly / lifetime 三档
- **邀请码系统**:
  - 老用户每月限生成 3 个 trial 邀请码
  - trial 每账号限领 1 次(LicenseClaim 表防羊毛)
- **社群评审工作流(L2 规则)**:
  - 评审员需付费会员
  - 一人一票(unique 约束 + upsert 可改票)
  - 不能评审自己提交的规则
  - ≥3 赞成 -> admin 终审
- **Admin SPA** (`apps/admin/`): Vue 3 + Vite + Naive UI + Pinia + UnoCSS
  - 8 个页面: Login / Dashboard / DMCA 列表+详情 / Rule 评审 / License 管理 / User 管理 / Audit Logs
  - JWT 鉴权 + 401 自动刷新 token
  - 路由守卫 super_admin 角色检查
  - Dockerfile 两阶段构建 + nginx SPA fallback
- **vitepress 文档站** (`apps/docs-site/`):
  - 首页 + 快速开始 + SDK 文档 + 5 个 quickstart
  - 合规页面(DMCA webform / takedown / 透明度报告)
  - Dockerfile + nginx 静态托管
- **Sentry 监控接入**(API 已接,admin 前端待接)
- **e2e smoke 测试**(`scripts/e2e-v0.5-smoke.mjs`):
  - SDK 冷启动 + arxiv 单源 + 流式回调
  - 合规边界 grep(13 个禁止模式: 夸克/阿里云盘/123pan/magnet/bt./破解版/激活码等)
- **数据库 migration 脚本**(`scripts/sql/`):
  - `add-dmca-notice-table.sql`
  - `add-rule-subscription-review-tables.sql`

### Changed

- **协议**: AGPL-3.0 (SDK 核心) + MIT (插件) 双协议
- **技术栈**:
  - 前端从 Nuxt 3 改为 vitepress 文档站 + Vue 3 admin SPA
  - API 模块从 12+ 砍到 5 个 + health + dmca
  - schema 从 30+ 表砍到 5 张核心 + 4 张辅助
- **User 模型**: 移除 `githubId` / `githubUsername`(GitHub OAuth 改为后续可选)
- **License.generatedBy**: 改为可空(支持 WM webhook 入库时未知生成者)
- **lint-staged**: 排除 `apps/docs-site/` + `apps/admin/` + `packages/`(各自工具链)
- **docker-compose healthcheck**: redis + mysql 改用 `CMD-SHELL` 绕过 LXD 嵌套容器 breakout 检测
- **API depends_on redis**: 从 `service_healthy` 改为 `service_started`(避免 healthcheck 异常阻塞 api 启动)
- **README**: 重写为 v0.5 1 页纸定位

### Removed

- **Nuxt Web 应用**(整个 `apps/web/` 目录)
- **API 模块**: search / provider / search-history / favorite / takedown / blocked-keyword / link-checker / invite-code / membership-code / agreement / collection / subscription / recommendation / subtitle / download / api-key / cloud-account / telegram-bot 等 19 个
- **数据库表**: favorites / search_logs / search_histories / collections / collection_items / takedown_records / blocked_keywords / invite_codes / membership_codes / agreements / user_agreements / user_preferences / api_keys / telegram_bots / api_logs / link_status_records / subscriptions 等 25+ 张表
- **GitHub OAuth**(暂时移除,M2 阶段可选恢复)
- **Caddy 反代**(改用 nginx,雨云 vhost)
- **PM2 进程管理**(改用 Docker Compose)
- **PanSou / TG Collector / DHT Crawler**(v0.4.1 遗留,v0.5 不再调用)

### 5 条不可逾越的红线

1. 不在 SDK 默认包里塞任何指向具体网盘/磁力/盗版站的 Rule
2. L3/L4 规则永远不对非 admin 可见(即使付费)
3. 不做评论 / 评分 / 论坛功能(违反 R4 永不)
4. 不在 `apps/api/src/modules/rule/` 里出现 `axios`/`fetch`/`http.`(服务端不能发 outbound 调用 L3/L4 资源站)
5. 不集成支付 SDK(用 WM 卡 SKU + webhook 就够)

---

## [0.4.1] - 2026-07-16

### Added

- AI 资源标签(基于标题规则匹配自动分类)
- AI 资源推荐(基于搜索历史 + Meilisearch 相似度)
- 关键词订阅 + 邮件通知(每 2 小时检查)
- 资源有效性投票(群体智慧维护)
- 字幕搜索(对接 OpenSubtitles API)
- 字幕配置教程(`docs/SUBTITLE-GUIDE.md`)
- 下载队列(对接 aria2 JSON-RPC)
- 资源合集(主题合集 + 资源管理)
- PWA 支持(manifest + theme-color)
- 搜索历史时间线(日期分组时间轴)
- 资源封面图墙(Netflix 风格 grid)
- Provider 自动降级(健康度 < 30 禁用,> 70 恢复)
- 快捷键帮助面板 + 主题切换按钮

---

## [0.4.0] - 2026-07-14

### Added

- TG 频道直连(独立 tg-collector 服务)
- 资源论坛 Provider(通用框架)
- DHT 自爬(独立 dht-crawler 服务)
- 夸克网盘转存(完整 API 逆向)
- 自定义 Provider 插件文档

---

## [0.3.3] - 2026-07-14

### Added

- API Key 权限细分(scopes)
- Telegram Bot
- 浏览器插件

---

## [0.3.2] - 2026-07-14

### Added

- 资源详情页 + 分享卡片
- 登录设备管理
- Provider 健康度评分
- 用户行为分析面板

---

## [0.3.1] - 2026-07-14

### Added

- 搜索建议 / 过滤 / 排序 / 快捷键 / 收藏夹分组

---

## [0.3.0] - 2026-07-13

### Added

- 部署脚本 + 生产配置 + 部署文档
- 开源文档(README / CONTRIBUTING / Issue 模板)
- Sentry 监控配置

---

## [0.2.0] - 2026-07-13

### Added

- 性能优化(缓存分级 TTL + Provider 流式返回)
- GitHub OAuth 登录
- API 开放(API Key 鉴权 + 限流)
- husky / eslint 修复 + Prisma 迁移 + 测试覆盖率达标

---

## [0.1.0] - 2026-07-13

### Added

- MVP 骨架
  - 后端 NestJS + Fastify + Prisma
  - 前端 Nuxt 3 SSR + Naive UI + Pinia
  - Docker Compose 部署配置
  - Caddy 反向代理 + 自动 HTTPS
  - Prisma schema 设计
  - Provider 插件框架
  - 用户系统(注册/登录/邮箱验证/密码重置)
  - 邀请码 + 会员激活码系统
  - 搜索聚合(PanSou API + 磁力站 + 网盘)
  - 搜索历史 + 收藏夹
  - 失效链接检测(BullMQ 定时任务)
  - 后台管理(用户列表/邀请码生成/审计日志)
  - 邮件服务(Resend + QQ SMTP)
  - 完整合规框架(takedown / 关键词黑名单 / 用户协议)

---

## [Unreleased - 2026-07-17 部署修复]

### Fixed

- index.vue 多行 `@click` 模板语法错误 -> Nuxt 全路由渲染失败(commit 47a9022)
- Prisma schema VarChar(2048) 复合 unique 索引超 3072 字节 -> 改为前缀索引 (length: 255)
- Docker alpine 镜像缺少 OpenSSL -> Prisma engine 启动失败
- Prisma engines 目录写权限 -> COPY 加 --chown=nestjs:nodejs
- esbuild pnpm store 残留版本错配 -> 改用 npmmirror + node-linker hoisted
- WM 发卡网占 80/443 -> SeekAll Caddy 改 8080/8443
- redis / mysql 数据卷 bind mount 权限问题 -> 改命名卷 + 健康检查 fix
- 容器重启 IP 漂移 -> seekall-api seekall-web 固定 172.18.0.5 172.18.0.6

### Changed

- docker-compose.yml 移除 Caddy 中转层(nginx on host 直连容器)
- nginx 加 Cross-Origin-* 安全头(COOP/CORP/COEP)+ 隐藏 x-powered-by
- nginx 加 1 年 immutable 静态资源缓存
- HTTPS 改由上游 nginx 终止(HSTS / 通配符证书)

### Added

- HK 服务器 cron 每天 3 点自动备份 MySQL + Redis + Meilisearch
  (`scripts/backup-cron.sh`,保留 30 天)
- admin 账号远程初始化工具(`scripts/setup-admin.py`)
- tg-collector / dht-crawler 部署骨架(待 TG Bot Token)
- docker-compose 关键服务固定 IP(重启不漂移)
- 部署运维脚本集合(deploy + rsync + cert + backup)

### Security

- 自签证书(*.winmelon.cn 通配符)已替换 nginx 配置
- 静态资源 1 年 immutable 缓存 + 隐藏技术栈指纹(x-powered-by)
