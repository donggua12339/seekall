# 觅源 SeekAll 架构设计

> 版本：v0.6 | 最后更新：2026-07-28

---

## 整体架构

```
                        用户浏览器
                            │
                       HTTPS (443)
                            │
                            ▼
               ┌─────────────────────────┐
               │   Cloudflare (仅 DNS)    │
               └────────────┬────────────┘
                            │
                            ▼
               ┌─────────────────────────┐
               │  主机 nginx (雨云 apt)   │
               │  Let's Encrypt 通配符    │
               │  *.winmelon.cn          │
               └──┬──────┬──────┬───────┘
                  │      │      │
     seekall.    │      │      │   user.
     winmelon.cn │      │      │   seekall.
                  │      │      │   winmelon.cn
                  │      │      │
                  ▼      ▼      ▼
            ┌────────┐ ────────┐ ┌──────────┐
            │docs-site│ │ admin  │ │ user-spa │
            │.6 :80  │ │.7 :80  │ │.9 :80    │
            │VitePress│ │Vue 3   │ │Vue 3     │
            └────────┘ └────────┘ └──────────┘
                  │      │      │
                  │  /api/* 反代  │
                  ▼      ▼      ▼
               ┌─────────────────┐
               │  seekall-api    │
               │  .5 :7301      │
               │  NestJS+Fastify │
               └──┬────┬────┬───┘
                  │    │    │
                  ▼    ▼    ▼
            ┌──────┐ ┌─────┐ ┌───────────┐
            │MySQL 8│ │Redis│ │Meilisearch│
            │  :3306│ │:6379│ │   :7700   │
            └──────┘ └───── └───────────┘
```

### 网络拓扑

| 域名                      | 容器                | IP         | 端口 | 说明                          |
| ------------------------- | ------------------- | ---------- | ---- | ----------------------------- |
| seekall.winmelon.cn       | seekall-docs-site   | 172.18.0.6 | 80   | VitePress 静态站 + /api/ 反代 |
| admin.seekall.winmelon.cn | seekall-admin       | 172.18.0.7 | 80   | Admin SPA + /api/ 反代        |
| user.seekall.winmelon.cn  | seekall-user-spa    | 172.18.0.9 | 80   | User SPA + /api/ 反代         |
| _(内部)_                  | seekall-api         | 172.18.0.5 | 7301 | NestJS API                    |
| _(内部)_                  | seekall-mysql       | 动态       | 3306 | MySQL 8                       |
| _(内部)_                  | seekall-redis       | 动态       | 6379 | Redis 7                       |
| _(内部)_                  | seekall-meilisearch | 动态       | 7700 | Meilisearch（预留）           |

每个前端容器的 nginx 都配了 `location /api/ { proxy_pass http://172.18.0.5:7301; }` 反代到 API。

---

## 后端模块（apps/api）

```
src/
├── common/
│   ├── constants/
│   │   └── error-codes.ts        # 5 位错误码体系
│   ├── decorators/
│   │   ├── public.decorator.ts    # @Public() 豁免 JWT
│   │   ├── roles.decorator.ts     # @Roles('super_admin')
│   │   └── current-user.decorator.ts  # @CurrentUser('sub')
│   ├── filters/
│   │   └── http-exception.filter.ts   # 全局异常 → {code, data, message}
│   ├── guards/
│   │   └── jwt-auth.guard.ts     # JWT 校验 + 软认证（public 路由也解析 token）
│   ├── interceptors/
│   │   └── response.interceptor.ts    # 统一响应包装
│   └── utils/
│       ├── hash.util.ts           # argon2 哈希
│       └── invite-code.util.ts    # 邀请码生成
├── config/
│   └── env.validation.ts          # 环境变量校验
├── database/
│   ├── prisma.service.ts          # Prisma 连接
│   └── redis.module.ts            # Redis 连接
├── modules/
│   ├── auth/                      # 注册/登录/邮箱验证/密码重置/refresh
│   ├── user/                      # 个人资料/交易/收据/退款/云同步
│   ├── admin/                     # dashboard/users/audit/analytics/badge/设置
│   ├── rule/                      # 列表/提交/评审/终审/takedown/subscribe/contributors
│   ├── license/                   # generate/redeem/disable/invite-trial/wm-webhook
│   ├── search/                    # greenhub + pansou 并行搜索
│   ├── dmca/                      # 公众提交 + admin 处理 + 透明度报告
│   ├── mail/                      # Resend + QQ SMTP
│   └── health/                    # 健康检查
└── main.ts                        # 启动 + 全局管道/守卫/拦截器/限流
```

### 模块依赖关系

```
auth ──► prisma, redis, jwt, mail
user ──► prisma
admin ──► prisma
rule ──► prisma
license ──► prisma, config
search ──► prisma, @seekall/rule-greenhub, @seekall/rule-pansou
dmca ──► prisma, mail, redis
mail ──► config
health ──► prisma, redis
```

---

## 搜索架构

```
                    SearchController
                         │
                    SearchService.search()
                         │
              ┌──────────┼──────────┐
              │          │          │
              ▼          ▼          ▼
         greenhub    pansou    (订阅规则)
         (底座)      (底座)     (用户触发)
              │          │
     ┌────────┤     ┌────┤
     │11 源并行│     │3 源并行│
     │HTTP+cheerio│  │puppeteer│
     │+代理转移│     │无头浏览器│
     └────────┘     └────┘
              │          │
              ▼          ▼
         Promise.allSettled → 去重 → 域名聚合 → 返回
```

### greenhub（11 源 HTTP 并行）

| 源         | 分类 | 技术              |
| ---------- | ---- | ----------------- |
| 果核剥壳   | 软件 | WordPress cheerio |
| 423down    | 软件 | WordPress cheerio |
| 殁漂遥     | 软件 | WordPress cheerio |
| 乐软       | 软件 | WordPress cheerio |
| 小众软件   | 软件 | WordPress cheerio |
| 异次元软件 | 软件 | WordPress cheerio |
| ACGBNS     | 游戏 | WordPress cheerio |
| 游戏SSP    | 游戏 | WordPress cheerio |
| 脑洞       | 综合 | WordPress cheerio |
| 动漫花园   | 动漫 | 专用 table 解析   |
| 蜜柑计划   | 动漫 | 专用列表解析      |

**代理故障转移**：直连 4s 超时 → 大陆代理（socks4/5/http）最多 2 次 → 硬超时 12s 兜底。

### pansou（3 源无头浏览器并行）

| 源         | 技术                    |
| ---------- | ----------------------- |
| 夸克搜索   | puppeteer-core CSR 渲染 |
| UP云搜     | puppeteer-core CSR 渲染 |
| 阿里云盘搜 | puppeteer-core CSR 渲染 |

每次搜索临时 launch 浏览器，3 源 Promise.allSettled 并行，结束即 close。

---

## 前端架构

### Admin SPA（apps/admin）

- Vue 3 + Naive UI + Pinia + Vue Router
- 8 页面：Dashboard / DMCA / 规则评审 / License / 用户管理 / 退款审核 / 审计日志 / 系统设置
- JWT 认证 + 401 自动刷新
- 后端 @Roles('super_admin') 保护，前端不做角色拦截

### User SPA（apps/user-spa）

- Vue 3 + Naive UI + Pinia + Vue Router
- 搜索页独立路由（public，全屏沉浸式）
- MainLayout 内 14 页面（Dashboard / 市场 / 规则 / License / 订阅 / 交易 / 退款 / DMCA / 设置等）
- JWT 认证 + 401 自动刷新
- 搜索免登录（public 路由 + 软认证）

### Docs Site（apps/docs-site）

- VitePress 1.6 静态生成
- 指南 / SDK / 规则市场 / 合规 / API / Blog / 贡献者
- 内置 sitemap + robots.txt + OG meta
- 组件：RuleMarket.vue / ContributorsLeaderboard.vue

---

## 数据库架构

### 9 张表

```
users ──────┬──► licenses ──────► license_claims
            │
            ├──► rules ─────┬──► rule_subscriptions
            │               ├──► rule_reviews
            │               └──► dmca_notices
            │
            ├──► admin_audit_logs
            │
            └──► dmca_notices (handler)

configs (独立 key-value)
```

### 核心表字段

| 表                 | 关键字段                                               | 索引                                   |
| ------------------ | ------------------------------------------------------ | -------------------------------------- |
| users              | id, username, email, role, isPaid, tier, status, badge | status, isPaid                         |
| licenses           | id, code(unique), tier, status, usedBy                 | tier, status, generatedBy              |
| rules              | id, npmPackage(unique), riskLevel, status, authorId    | riskLevel, status, authorId            |
| admin_audit_logs   | id, adminId, action, targetType, targetId              | adminId, action, (targetType,targetId) |
| configs            | key(PK), value                                         | -                                      |
| license_claims     | id, userId, licenseId                                  | (userId,licenseId) unique              |
| rule_subscriptions | id, userId, ruleId                                     | (userId,ruleId) unique                 |
| rule_reviews       | id, ruleId, reviewerId, approve                        | (ruleId,reviewerId) unique             |
| dmca_notices       | id, status, ruleId, handlerAdminId                     | status, ruleId, createdAt              |

---

## 认证流程

```
注册 → status=active（直接可用）
     → 发送验证邮件（code 或 link，不阻断注册）
     → 用户可选验证邮箱

登录 → JWT Access (15min) + Refresh (7d)
     → Refresh Token 存 Redis Set（支持多设备）

API 请求 → JwtAuthGuard
         → @Public 路由：软认证（有 token 就解析，没有也放行）
         → 非 @Public 路由：必须有合法 token
         → @Roles 路由：额外检查 role
```

---

## 部署架构

### Docker Compose（7 服务）

```yaml
services:
  seekall-api: # NestJS, 172.18.0.5:7301
  seekall-docs-site: # VitePress+nginx, 172.18.0.6:80
  seekall-admin: # Vue3+nginx, 172.18.0.7:80
  seekall-user-spa: # Vue3+nginx, 172.18.0.9:80
  seekall-mysql: # MySQL 8, 3306
  seekall-redis: # Redis 7, 6379
  seekall-meilisearch: # Meilisearch, 7700 (预留)
```

### 构建注意

- **必须串行构建**：4GB 服务器并行 build 4 镜像会 OOM
- Alpine 镜像需 `apk add --no-cache openssl`（Prisma engine 依赖）
- pnpm 9 + hoisted 模式下 prisma generate 需用 `node node_modules/prisma/build/index.js generate`

### 主机 nginx

- 每个子域名一个 vhost 文件
- 通配符证书 `*.winmelon.cn`（Let's Encrypt）
- 每个前端 vhost 必须有 `/api/` 反代到 API 容器
- robots.txt 由主机 nginx 直接 serve（不走容器）

---

## 安全架构

### 5 条红线

1. SDK 默认包不塞网盘/磁力/盗版站 Rule
2. L3/L4 规则永不公开
3. 不做评论/评分/论坛
4. rule 模块禁止 outbound HTTP
5. 不集成支付 SDK

### 防御层

| 层   | 措施                                                           |
| ---- | -------------------------------------------------------------- |
| 网络 | Cloudflare DNS + HTTPS + HSTS                                  |
| 反代 | nginx 安全头（X-Frame-Options / CSP / X-Content-Type-Options） |
| 限流 | @nestjs/throttler 全局 + 端点级                                |
| 认证 | JWT + argon2 + Refresh 白名单                                  |
| 校验 | class-validator DTO + whitelist + forbidNonWhitelisted         |
| 注入 | Prisma 参数化查询                                              |
| XSS  | Vue 模板自动转义                                               |
| 监控 | Sentry 5xx 上报                                                |
| 合规 | DMCA §512(c) + 透明度报告                                      |
