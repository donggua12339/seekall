# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/zh-CN/spec/v2.0.0.html).

## [0.6.0] - 2026-07-28

### v0.6 完整版：留存 + 生态 + 搜索 + 规约

#### Added

- **注册直接 active**：不再卡 pending_verification，注册完即可登录
- **邮箱验证双模式**：验证码模式（6 位数字，Redis 10min）+ 链接模式（token，DB 30min），admin 可切换
- **JWT guard 软认证**：public 路由带合法 token 也解析 @CurrentUser
- **搜索免登录**：搜索页 @Public + 独立路由 + 顶部导航栏
- **pansou 默认开启**：加入 BASE_RULES，不需要手动勾选
- **pansou 并行化**：3 源 Promise.allSettled 并行渲染，超时 30s → 15s
- **搜索页导航栏**：登录/注册/用户中心/暗色切换，毛玻璃背景
- **热搜词优化**：6 → 12 个（考研/四级/我的世界/小说/电子书等）
- **Admin 系统设置页**：邮箱验证模式切换（code/link 单选）
- **项目规约文件**：spec.md / plan.md / tasks.md 补齐
- **ARCHITECTURE.md 重写**：从 v0.4 过时架构更新到 v0.6 实际架构
- **CONTRIBUTING.md 重写**：修正 Nuxt/Caddy/PanSou 等过时引用
- **SEO 文章 6 篇**：知乎 2 + CSDN 2 + dev.to 1 + Medium 1
- **小红书图文 3 条**：SDK 介绍 + 风险评级 + ¥1 试用
- **内容分发交接 prompt**：docs/content-publish-handoff.md

#### Fixed

- **注册后无法登录**：pending_verification 状态被登录拒绝，改为自动转 active
- **redeem 返回格式**：$transaction 返回裸 User → 改为 {license, user} + BigInt 安全序列化
- **邮件发送失败阻断注册**：try/catch 包裹，失败只记日志
- **僵尸 pending 用户**：重新注册时自动清理同 username/email 的 pending 记录
- **Dashboard 数据全 0**：deletedAt:null 查询在 v0.5 schema 不存在，改为 status:{not:'deleted'}
- **Dashboard 字段不匹配**：后端返回嵌套对象 vs 前端期望扁平字段，统一为扁平
- **Analytics 与 Dashboard 重叠**：合并到 Dashboard，删除独立路由和菜单
- **Admin 路由守卫**：去掉前端 isSuperAdmin 拦截（后端 @Roles 已保护）
- **Admin nginx 502**：proxy_pass 指向 172.18.0.8（meilisearch）改为 0.7（admin）
- **Admin nginx 405**：缺 /api/ location 反代，补上 proxy_pass 到 API 容器
- **meilisearch IP 冲突**：dht-meilisearch 遗留容器占 0.7，断开网络

#### Changed

- 搜索页从 MainLayout children 移出为独立 public 路由
- 去掉 pansou 勾选框（已默认跑）
- 加载提示从"11 个资源站"改为"14+ 个资源站"

---

## [0.5.4] - 2026-07-23

### v0.6 第二波：留存体验 + 生态建设

#### Added

- **Blog 接入 docs-site**：`/blog/tutorial-100-lines` + `/blog/why-not-website` 两篇技术博客
- **我的规则页**：`GET /api/v1/rules/my/submitted` 端点 + user-spa 周下载量列
- **贡献者徽章系统**：`PATCH /api/v1/admin/users/:id/badge` + admin 内联编辑 + Dashboard 展示
- **贡献者排行榜**：`GET /api/v1/rules/contributors/list`（raw SQL 聚合）+ `/contributors/` 页面
- **贡献者邀请计划**：`/contributors/contributor-invite` 提交 L0/L1 规则换终身会员
- **docs-site 首页改版**：最新动态区块 + 代码示例 + 贡献引导
- **SEO**：vitepress 内置 sitemap（24 URL）+ robots.txt + OG/Twitter meta
- **Google Search Console 验证**：HTML 文件验证
- **百度站长平台验证**：meta 标签验证

#### Fixed

- **CLI `rules list`**：`listMarketRules` 返回分页对象导致 `marketRules is not iterable`
- **CLI `rules install`**：npm 7+ `EALLOWSCRIPTS`，加 `--no-scripts` 标志
- **Dockerfile prisma generate**：pnpm 9 alpine + hoisted 模式下 `pnpm exec prisma` 找不到 bin，改用 `node node_modules/prisma/build/index.js generate`
- **SSL 证书 SAN**：certbot 重签丢域名，扩展覆盖 seekall/admin/user 三域名
- **Redis 权限**：`/data` owner root → chown redis:redis，修复 bgsave Permission denied
- **robots.txt 乱码**：中文注释 + nginx 不传 charset=utf-8，删除中文注释
- **contributors raw SQL**：MySQL 物理列名 snake_case（author_id），不是 Prisma camelCase

#### Changed

- 根 package.json 加 eslint devDependency（修 pre-commit hook）
- `@seekall/sdk` 版本 0.5.3 → 0.5.4

#### 运维教训

- docker build 4 容器并行导致服务器 OOM（load 1274），**必须串行 build**
- certbot certonly 不带 `--expand` 重签会丢原有 SAN 域名
- 百度 sitemap 配额 0 条（无 ICP 备案），只能用手动提交
- 主机 nginx `location = /robots.txt` 会覆盖 docs-site 容器里的 robots.txt

---

## [0.5.3] - 2026-07-22

### v0.6 第一波 + 运维修复

#### Added

- **邀请码裂变**：月度/终身会员每月 3 个 ¥1 试用邀请码
- **README 优化**：重写为规则引擎定位
- **npm 下载量统计**：规则市场 + admin Dashboard 展示上周下载量
- **User SPA 部署**：user.seekall.winmelon.cn 上线（172.18.0.9）

#### Fixed

- **L2 tier 校验白嫖漏洞**：trial 用户（isPaid=true）可订阅 L2，加 validateUserTier()
- **wm-webhook 3 bug**：@Public 缺失 / DTO amount 缺 @IsNumber / Secret 未配置

---

## [0.5.2] - 2026-07-21

### Quick Win + User SPA + SDK CLI

#### Added

- **User SPA**：14 页面 SaaS 级用户中心（Dashboard / 搜索 / 规则 / License / 订阅 / 交易 / 退款 / DMCA / 设置）
- **SDK CLI 完整命令集**：search / license redeem / sync / rules list|install|uninstall / config / whoami / init
- **性能差异化**：tier-based concurrency + timeout + in-memory cache
- **云同步**：configs 表 + CLI sync 命令
- **退款审核**：user 申请 + admin 审批 + License 自动禁用
- **OpenAPI 在线文档**：Redoc iframe + /api/v1/docs-json
- **17 个规则包发布**：6 L0 + 4 L1 + 7 L2

#### Fixed

- **限流**：@nestjs/throttler 全局 100/min + 认证端点 3-5/min
- **Swagger 生产收敛**：NODE_ENV !== production 守卫
- **robots.txt**：/var/www/seekall/robots.txt + nginx location
- **备份演练**：MySQL 9 表 + Redis RDB 验证

---

## [0.5.1] - 2026-07-19

### 上线后修复

#### Fixed

- **WM webhook 实测**：3 bug 修复后生产闭环（订单 337300568525508608）
- **npm publish**：@seekall/sdk + 5 规则包首发
- **docs-site /health**：vitepress nginx 加健康检查路由
- **GET /rules 校验**：riskLevel 枚举序列化修复

---

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
