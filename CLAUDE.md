# CLAUDE.md - 觅源 SeekAll 项目宪章

> 本文档是 SeekAll 项目的强制约束规范,所有代码必须遵守。AI 助手在协助开发时必须遵循本宪章。
> v0.5 重构:从 Nuxt Web 搜索网站改为规则引擎 SDK + 市场 + BaaS。

## 项目简介

- **中文名**: 觅源
- **英文名**: SeekAll
- **版本**: v0.5.0
- **定位**: 中立的搜索规则 SDK + 规则市场 + BaaS(默认 0 规则,工具中性合规)
- **核心原则**: 服务端零接触资源,规则在用户本机跑,只做账号 / 规则市场列表 / DMCA 邮箱
- **协议**: AGPL-3.0(SDK 核心) + MIT(插件)
- **域名**: `seekall.winmelon.cn`(文档站)+ `admin.seekall.winmelon.cn`(admin SPA)
- **仓库**: https://github.com/donggua12339/seekall

## 5 条不可逾越的红线

1. **不在 SDK 默认包里塞任何指向具体网盘 / 磁力 / 盗版站的 Rule**
2. **L3/L4 规则永远不对非 admin 可见**(即使付费)
3. **不做评论 / 评分 / 论坛功能**(违反 R4 永不)
4. **不在 `apps/api/src/modules/rule/` 里出现 `axios` / `fetch` / `http.`**(服务端不能发 outbound 调用 L3/L4 资源站)
5. **不集成支付 SDK**(用 WM 卡 SKU + webhook 就够)

## 技术栈

| 层        | 选型                                                                                  |
| --------- | ------------------------------------------------------------------------------------- |
| SDK       | TypeScript + tsup(ESM,Node 20+)                                                       |
| 后端      | NestJS 10 + Fastify + TypeScript + Prisma 5.22                                        |
| 数据库    | MySQL 8 + Redis 7                                                                     |
| 全文检索  | Meilisearch(v0.5 暂未用,v0.4.1 容器保留)                                              |
| 任务队列  | BullMQ                                                                                |
| 邮件      | Resend(主)+ QQ 邮箱 SMTP(备)                                                          |
| 反向代理  | 雨云 apt nginx(1.18)+ Let's Encrypt(certbot)                                          |
| 容器化    | Docker Compose v2 单机(6 服务: api / admin / docs-site / mysql / redis / meilisearch) |
| API 文档  | Swagger(prod 关闭)                                                                    |
| 认证      | JWT Access(15m)+ Refresh(7d)+ argon2                                                  |
| 监控      | Sentry(API 已接,admin 前端已接)                                                       |
| monorepo  | pnpm 9 workspace                                                                      |
| 文档站    | VitePress 1.5(静态)                                                                   |
| Admin SPA | Vue 3 + Vite + TypeScript + Naive UI + Pinia + UnoCSS                                 |

## 目录结构(v0.5)

```
seekall/
├── apps/
│   ├── api/                      # NestJS 后端
│   │   ├── src/
│   │   │   ├── common/           # 公共(装饰器 / 过滤器 / 守卫 / 拦截器)
│   │   │   ├── config/           # env.validation
│   │   │   ├── database/         # prisma / redis service
│   │   │   └── modules/          # 业务模块(7 个)
│   │   │       ├── auth/         # 注册 / 登录 / 邮箱验证 / 密码重置 / refresh / sessions
│   │   │       ├── user/         # 个人资料
│   │   │       ├── admin/        # dashboard / users / audit-logs / analytics / transparency
│   │   │       ├── rule/         # 列表 / 提交 / 评审 / 终审 / takedown / subscribe / unsubscribe
│   │   │       ├── license/      # generate / list / redeem / disable / invite-trial / wm-webhook
│   │   │       ├── dmca/         # 公众提交 / admin 处理 / 透明度报告 cron
│   │   │       ├── mail/         # Resend + QQ SMTP
│   │   │       └── health/       # 健康检查
│   │   ├── prisma/
│   │   │   ├── schema.prisma     # 5 核心 + 4 辅助表
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── test/
│   │   ├── Dockerfile            # 两阶段 alpine + prisma engine
│   │   ├── nest-cli.json
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── admin/                    # Vue 3 Admin SPA
│   │   ├── src/
│   │   │   ├── api/              # axios + JWT 拦截器
│   │   │   ├── stores/           # Pinia (auth + app)
│   │   │   ├── router/           # 路由守卫 super_admin 检查
│   │   │   ├── layouts/          # MainLayout (侧边栏 + 顶栏)
│   │   │   └── views/            # 8 个页面
│   │   │       ├── Login.vue
│   │   │       ├── Dashboard.vue
│   │   │       ├── dmca/List.vue + Detail.vue
│   │   │       ├── rule/List.vue
│   │   │       ├── license/List.vue
│   │   │       ├── user/List.vue
│   │   │       ├── AuditLogs.vue
│   │   │       └── NotFound.vue
│   │   ├── Dockerfile            # 两阶段 build (node:20-alpine -> nginx:alpine)
│   │   ├── nginx.conf            # SPA fallback + 安全头 + noindex
│   │   └── package.json
│   └── docs-site/                # VitePress 静态文档站
│       ├── .vitepress/
│       │   └── config.ts
│       ├── index.md              # 首页
│       ├── guide/                # SDK 文档 + 5 个 quickstart
│       ├── sdk/                  # 写规则 + API
│       ├── compliance/           # DMCA webform + takedown + 透明度
│       ├── admin/                # admin 使用手册(内部)
│       └── Dockerfile
├── packages/
│   ├── sdk/                      # @seekall/sdk
│   │   ├── src/
│   │   │   ├── index.ts          # createEngine + Rule 接口 + Hit 类型
│   │   │   └── cli.ts            # npx @seekall/sdk init [name]
│   │   ├── tsup.config.ts        # 双 entry(index + cli)
│   │   └── package.json          # bin: seekall
│   ├── rule-arxiv/               # @seekall/rule-arxiv (L0 示例)
│   ├── rule-crossref/            # @seekall/rule-crossref (L0 示例)
│   └── rule-pubmed/              # @seekall/rule-pubmed (L0 示例)
├── docker/
│   ├── docker-compose.yml        # 6 服务(api/admin/docs-site/mysql/redis/meilisearch)
│   ├── mysql/                    # init SQL + conf.d
│   ├── redis/data/               # AOF 持久化
│   ├── meilisearch/data/
│   └── backups/mysql/            # cron 每天 3 点备份
├── scripts/
│   ├── sql/                      # 手动 migration SQL
│   │   ├── add-dmca-notice-table.sql
│   │   └── add-rule-subscription-review-tables.sql
│   ├── e2e-v0.5-smoke.mjs        # e2e 测试(SDK + 合规 grep)
│   ├── backup-cron.sh            # 数据库定时备份
│   └── setup-admin.py            # admin 账号远程初始化
├── docs/
│   ├── dmca-notice-template.md   # DMCA Takedown Notice 邮件模板
│   ├── xiaohongshu-draft.md      # 小红书软文草稿
│   └── ops-issues-*.md           # 运维问题清单
├── .eslintrc.cjs                 # root barrier + ignorePatterns
├── .lintstagedrc.cjs             # 排除 apps/admin + apps/docs-site + packages
├── pnpm-workspace.yaml
├── package.json                  # husky 9 + lint-staged 15 + commitlint 19
├── tsconfig.json
└── CHANGELOG.md
```

## 数据库 schema(v0.5)

5 张核心表 + 4 张辅助表:

### 核心

| 表                 | 用途                                                                |
| ------------------ | ------------------------------------------------------------------- |
| `users`            | 用户(super_admin / user + isPaid + tier + status)                   |
| `licenses`         | License code(trial / monthly / lifetime + unused / used / disabled) |
| `rules`            | 规则市场(npmPackage + riskLevel + status + takedownCount)           |
| `admin_audit_logs` | 所有 admin 操作 + Rule 评审历史                                     |
| `configs`          | key-value 系统(透明度报告持久化)                                    |

### 辅助

| 表                   | 用途                                              |
| -------------------- | ------------------------------------------------- |
| `license_claims`     | LicenseClaim 防 trial 羊毛(每账号限领 1 次)       |
| `rule_subscriptions` | 规则订阅(unique [userId, ruleId] 幂等)            |
| `rule_reviews`       | L2 规则评审(unique [ruleId, reviewerId] 一人一票) |
| `dmca_notices`       | DMCA Takedown 记录(永不删除)                      |

### 枚举

- `UserRole`: super_admin / user
- `UserStatus`: pending_verification / active / banned / deleted
- `LicenseTier`: trial / monthly / lifetime
- `LicenseStatus`: unused / used / disabled
- `RuleRiskLevel`: l0 / l1 / l2 / l3 / l4
- `RuleStatus`: pending_review / published / taken_down / banned
- `DmcaReporterRole`: owner / agent
- `DmcaNoticeStatus`: pending / verified / actioned / rejected

## API 模块(v0.5)

### 公开端点

- `POST /api/v1/auth/register` 注册
- `POST /api/v1/auth/login` 登录
- `POST /api/v1/auth/verify-email` 邮箱验证
- `POST /api/v1/auth/request-password-reset` 申请重置
- `POST /api/v1/auth/reset-password` 重置密码
- `POST /api/v1/auth/refresh` 刷新 token
- `GET /api/v1/health` 健康检查
- `GET /api/v1/rules` 规则列表(L0-L2 公开)
- `GET /api/v1/rules/:id` 规则详情
- `POST /api/v1/license/wm-webhook` WM 发卡网回调
- `POST /api/v1/dmca/notice` DMCA 提交(每 IP 3 次/小时)
- `GET /api/v1/dmca/transparency` 透明度报告(默认上月)
- `GET /api/v1/dmca/transparency/history` 历史报告列表
- `GET /api/v1/dmca/transparency/:yearMonth` 指定月报告

### 用户端点(Bearer JWT)

- `GET /api/v1/auth/sessions` 登录设备列表
- `DELETE /api/v1/auth/sessions/:id` 撤销会话
- `POST /api/v1/auth/logout` 退出
- `GET /api/v1/user/me` 个人资料
- `PATCH /api/v1/user/me` 修改资料
- `POST /api/v1/rules` 提交规则(L0/L1 自动上架,L2 评审)
- `POST /api/v1/rules/:id/review` 评审 L2 规则(需付费会员)
- `POST /api/v1/rules/:id/subscribe` 订阅(幂等)
- `DELETE /api/v1/rules/:id/subscribe` 取消订阅
- `GET /api/v1/rules/my/subscriptions` SDK 拉取订阅
- `POST /api/v1/license/redeem` 兑换 license code
- `POST /api/v1/license/invite-trial` 老用户生成 ¥1 试用邀请码(每月 3 个)
- `GET /api/v1/license/invite-trial/my` 本月邀请码用量

### Admin 端点(Bearer JWT + super_admin)

- `GET /api/v1/admin/dashboard` 控制台数据
- `GET /api/v1/admin/users` 用户列表
- `PATCH /api/v1/admin/users/:id/ban` 封禁
- `PATCH /api/v1/admin/users/:id/unban` 解封
- `GET /api/v1/admin/audit-logs` 审计日志
- `GET /api/v1/admin/transparency` 透明度报告
- `POST /api/v1/admin/rules` 创建 L3/L4 规则
- `POST /api/v1/admin/rules/:id/final-review` 终审 L2
- `POST /api/v1/admin/rules/:id/takedown` DMCA 下架
- `POST /api/v1/admin/license/generate` 生成 license(批量)
- `GET /api/v1/admin/license` license 列表
- `GET /api/v1/admin/license/:id` license 详情
- `POST /api/v1/admin/license/:id/disable` 禁用
- `GET /api/v1/admin/dmca` DMCA 举报列表
- `GET /api/v1/admin/dmca/:id` 详情
- `POST /api/v1/admin/dmca/:id/handle` 处理(verify / action / reject)

## 5 级风险评级 + 5 维权限矩阵

| 级别 | 含义                                | 可见     | 可订阅 |
| ---- | ----------------------------------- | -------- | ------ |
| L0   | 学术纯净(arxiv / crossref / pubmed) | 所有人   | 免费   |
| L1   | 通用开源(GitHub API)                | 所有人   | 免费   |
| L2   | 社区评审(需付费会员评审)            | 所有人   | 付费   |
| L3   | 高风险(admin 创建,仅 admin 可见)    | 仅 admin | 永不   |
| L4   | 极高风险(admin 创建,仅 admin 可见)  | 仅 admin | 永不   |

5 维权限矩阵: View / Run / Save / Upload / Author

## 会员档位

| 档位     | 价格 | 时长   | 权限                             |
| -------- | ---- | ------ | -------------------------------- |
| trial    | ¥1   | 7 天   | L0-L1 订阅                       |
| monthly  | ¥18  | 30 天  | L0-L2 订阅 + 评审权 + 邀请码生成 |
| lifetime | ¥68  | 100 年 | 同 monthly                       |

## 部署信息

- **服务器**: 海外 VPS(无备案),SSH 端口非默认
- **SSH 用户**: 非 root,sudoers 白名单: docker / nginx / xray / git
- **项目目录**: `/opt/seekall-v0.5`
- **DNS**: `seekall.winmelon.cn` + `admin.seekall.winmelon.cn` + `user.seekall.winmelon.cn`
- **nginx**: 主机 apt nginx,反代到 docker 容器 IP
  - `seekall.winmelon.cn` -> docs-site 172.18.0.6:80 + api 172.18.0.5:7301
  - `admin.seekall.winmelon.cn` -> admin 172.18.0.7:80
  - `user.seekall.winmelon.cn` -> user-spa 172.18.0.9:80
- **敏感信息**(服务器 IP / SSH 端口 / 用户名 / 密码)见本地 `docs/OPS-PRIVATE.md`(已 gitignore)

## 容器 IP 分配(固定)

| 容器                | IP         | 端口            |
| ------------------- | ---------- | --------------- |
| seekall-api         | 172.18.0.5 | 7301(内部)      |
| seekall-docs-site   | 172.18.0.6 | 80(内部)        |
| seekall-admin       | 172.18.0.7 | 80(内部)        |
| seekall-mysql       | 172.18.0.x | 3306(127.0.0.1) |
| seekall-redis       | 172.18.0.x | 6379(127.0.0.1) |
| seekall-meilisearch | 172.18.0.x | 7700(127.0.0.1) |

## 常用命令

```bash
# API 编译验证
cd apps/api && rm -rf dist && npx nest build

# Admin SPA 编译
cd apps/admin && pnpm run build

# SDK 编译
pnpm --filter @seekall/sdk build

# e2e smoke 测试(本地,跳过 server)
node scripts/e2e-v0.5-smoke.mjs --skip-server

# 单元测试
cd apps/api && npx jest

# Prisma generate(改 schema 后)
cd apps/api && npx prisma generate

# 服务器部署(完整流程)
# 1. 本地 commit + push
git add -A && git commit -m "..." && git push origin master
# 2. 服务器拉取(SSH 信息见 docs/OPS-PRIVATE.md)
ssh <SSH_USER>@<SERVER_IP> -p <SSH_PORT>
cd ~/seekall && git pull origin master
# 3. cp /opt/seekall-v0.5(docker run --rm -v 方案,sudoers 限制)
sudo docker run --rm -v /opt:/opt -v /home/<SSH_USER>:/home alpine:3.18 sh -c "
  rm -rf /opt/seekall-v0.5
  cp -a /home/seekall /opt/seekall-v0.5
  chown -R root:root /opt/seekall-v0.5
"
# 4. SQL migration(如有 schema 改动)
cd /opt/seekall-v0.5/docker
sudo docker exec -i seekall-mysql mysql -uroot -p$MYSQL_ROOT_PASSWORD seekall < /opt/seekall-v0.5/scripts/sql/add-xxx.sql
# 5. 串行重建容器(不要并行 4 个,会 OOM)
sudo docker compose build seekall-api && sudo docker compose build seekall-admin
sudo docker compose up -d --no-deps seekall-api seekall-admin
# 6. 验证
curl http://172.18.0.5:7301/api/v1/health
curl http://172.18.0.7/health
```

## 已知踩过的坑(供参考)

1. **sudoers 限制** - SSH 用户只能 sudo docker / nginx / xray / git,不能 sudo cp / nohup / bash 内部命令
   - 复制文件到 /opt 用 `sudo docker run --rm -v /opt:/opt alpine cp ...`
2. **SSH key + sudo git** - `sudo git` 会重置 HOME,读不到 SSH config,git pull 失败
   - 解决: 先在 SSH 用户 home git pull,再用 docker cp 到 /opt
3. **LXD 嵌套容器 docker exec breakout** - `docker exec CMD` 形式报 "container breakout detected"
   - 解决: healthcheck 改用 `CMD-SHELL`(redis/mysql 已修)
4. **lint-staged 路径含空格** - "Claude Code Haha" 路径含空格,ESLint 报 "No files matching pattern"
   - 【2026-08-03 已搬离】项目已从含空格的 "Claude Code Haha" 目录搬到 `D:/projects/seekall`(无空格),此坑根因已消除;下方 quote() 方案保留无害
   - 解决(历史): `.lintstagedrc.cjs` 用函数形式 + `quote()` 包引号 + 排除 apps/admin / apps/docs-site / packages
5. **v0.5 不在 /opt/seekall-v0.5/.git** - 服务器上的 /opt/seekall-v0.5 是从 home seekall cp 来的,git 历史在 ~/seekall
6. **Prisma JsonFilter 不支持 path+equals** - 改用 findMany 后端 `.filter()` 处理
7. **AdminAuditLog.targetId 可空** - findMany 后必须 `.filter((x): x is bigint => x !== null)`
8. **commitlint subject 大写报错** - subject 必须小写,footer 行宽 ≤100
9. **ESM shebang 不工作** - Node ESM 解析报错,SDK CLI 不加 banner,由 npm bin 字段处理
10. **hoisted 布局下 install 不自动跑 prisma generate** - `.npmrc` 用 `node-linker=hoisted`(解 Windows 7-zip/CC 扫 node_modules 报错,详见 memory feedback_pnpm_windows_hoisted)。但 hoisted 下 `pnpm install` **不会**自动触发 `@prisma/client` 的 generate,导致根 `@prisma/client` 是空壳,`nest build` 报上百条 `Property 'xxx' does not exist on type 'PrismaService'`。
    - 解决: install 后跑一次 `pnpm db:gen`(= `pnpm --filter @seekall/api run prisma:generate`),或 `cd apps/api && npx prisma generate`。generate 后再 build/test 即正常。每次 `git clone` + `pnpm install` 后都要记得跑这条。

## v0.5 已完成里程碑

- ✅ D1-D5: 砍 Nuxt + vitepress + schema 重写 + README
- ✅ D6-D10: SDK 核心 + 3 个示例规则 + 文档
- ✅ D11-D15: BaaS 最小化(auth / license / rule / admin / audit)
- ✅ D16-D20: docs-site 部署 + WM webhook + DMCA + e2e
- ✅ P1 修复(docs-site healthcheck + rules 校验)
- ✅ P2-1 DMCA webform 后端 API
- ✅ P2-2 RuleSubscription 独立表
- ✅ P2-3 admin SPA 完整(8 页面 + Dockerfile)
- ✅ P3 服务器部署(DNS + nginx + SQL migration + docker compose)
- ✅ P4 Redis healthcheck + CHANGELOG + 透明度 cron + SDK CLI + admin Sentry + 单元测试
- ✅ 清理 v0.4.1 残留(apps/browser-extension / apps/dht-crawler / apps/tg-bot / apps/tg-collector / services/ / systemd)

## 待办

- HTTPS 真证书替换自签(任务 #12 pending)
- WM 卡 webhook 实测(等 WM 后台配置)
- 3 个示例规则 npm publish
- 小红书软文发布
- DMCA Agent 注册(用户量起来后)
- M2: 社群评审 UI 完善(评审工作流后端已建,前端待补)
- M3: DMCA webform 后端 API 接入(已完成,可考虑加 admin 复核 UI)

## 联系方式

- **GitHub**: https://github.com/donggua12339/seekall
- **最新 commit**: 见 `git log --oneline -1`
- **部署文档**: `/opt/seekall-v0.5/CHANGELOG.md`
- **admin 手册**: `apps/docs-site/admin/guide.md`
- **运维清单**: `docs/ops-issues-*.md`
