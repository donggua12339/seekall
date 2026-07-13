# 觅源 SeekAll - 架构设计

## 整体架构

```
┌─────────────────────────────────────────────────┐
│                   用户浏览器                      │
└────────────────┬────────────────────────────────┘
                 │ HTTPS
                 ▼
┌─────────────────────────────────────────────────┐
│              Cloudflare (仅 DNS)                 │
└────────────────┬────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────┐
│              Caddy (反向代理 + HTTPS)            │
│   seekall.winmelon.cn / admin.seekall.winmelon.cn │
└──────┬──────────────────────────────┬───────────┘
       │ /api/*                        │ /*
       ▼                                ▼
┌──────────────┐               ┌──────────────┐
│  seekall-api │               │  seekall-web │
│  (NestJS)    │◄──────────────│  (Nuxt 3 SSR)│
└──────┬───────┘   HTTP        └──────────────┘
       │
       ├──► MySQL 8 (主数据)
       ├──► Redis 7 (缓存 + 限流 + 队列)
       ├──► Meilisearch (全文检索)
       ├──► Resend / QQ SMTP (邮件)
       └──► 外部 Provider (PanSou / 磁力站 / 夸克)
```

## 模块划分

### 后端 (apps/api)

```
src/
├── common/                # 公共层
│   ├── constants/         # 错误码、枚举
│   ├── decorators/        # @Public @Roles @CurrentUser
│   ├── filters/           # 全局异常过滤器
│   ├── guards/            # JWT 守卫
│   ├── interceptors/      # 响应拦截器
│   └── utils/             # 工具函数
├── config/                # 环境变量校验
├── database/              # Prisma + Redis
├── modules/
│   ├── auth/              # 认证（注册/登录/邮箱验证/密码重置）
│   ├── user/              # 用户（个人主页/偏好/会员激活/注销）
│   ├── invite-code/       # 邀请码（注册用）
│   ├── membership-code/   # 会员激活码（付费用）
│   ├── search/            # 搜索聚合（缓存/去重/过滤）
│   ├── provider/          # Provider 框架
│   │   ├── interfaces/    # IProvider 接口
│   │   └── providers/     # 具体实现（pansou/magnet/quark）
│   ├── search-history/    # 搜索历史
│   ├── favorite/          # 收藏夹
│   ├── takedown/          # 侵权举报、下架
│   ├── blocked-keyword/   # 关键词黑名单
│   ├── link-checker/      # 失效链接检测（BullMQ）
│   ├── admin/             # 后台管理
│   ├── agreement/         # 用户协议
│   ├── mail/              # 邮件服务（Resend/QQ）
│   ├── meilisearch/       # Meilisearch 客户端
│   └── health/            # 健康检查
└── workers/               # 定时任务（清理日志/链接检测）
```

### 前端 (apps/web)

```
├── pages/
│   ├── index.vue          # 首页（搜索框）
│   ├── search.vue         # 搜索结果
│   ├── auth/
│   │   ├── login.vue
│   │   ├── register.vue
│   │   ├── verify-email.vue
│   │   └── reset-password.vue
│   ├── profile.vue        # 个人主页
│   ├── favorites.vue      # 收藏夹
│   ├── takedown.vue       # 侵权举报
│   ├── agreement.vue      # 用户协议
│   └── admin/             # 后台
├── components/
│   ├── AppHeader.vue
│   ├── AppFooter.vue
│   └── admin/             # 后台管理组件
├── layouts/
│   ├── default.vue        # 默认布局
│   └── admin.vue          # 后台布局
├── stores/
│   └── auth.ts            # 认证状态
├── composables/
│   └── useApi.ts          # API 调用封装
└── uno.config.ts          # UnoCSS 配置
```

## 数据流

### 搜索流程

```
用户输入关键词
    ↓
前端 GET /api/v1/search?keyword=xxx
    ↓
SearchController → SearchService
    ↓
┌─ 关键词黑名单校验
├─ Redis 缓存查询
│   ├─ 命中 → 直接返回
│   └─ 未命中 → 继续
├─ ProviderService.searchAll()
│   ├─ Promise.allSettled 并发调用所有 Provider
│   ├─ 单源 5s 超时，失败降级
│   └─ 结果合并
├─ URL 去重（MD5 hash）
├─ 过滤失效链接（link_status 表）
├─ 过滤 takedown 资源
├─ 分页
├─ 写 Redis 缓存（1 小时 TTL）
├─ 写搜索日志
└─ 返回结果
```

### 注册流程

```
用户填写邀请码 + 用户名 + 邮箱 + 密码 + 协议
    ↓
POST /api/v1/auth/register
    ↓
AuthService.register()
    ├─ 校验邀请码（格式 + 状态 + 过期）
    ├─ 校验用户名/邮箱唯一性
    ├─ 密码强度校验
    ├─ argon2 哈希密码
    ├─ 创建用户（status: pending_verification）
    ├─ 标记邀请码已使用
    ├─ 创建用户偏好
    ├─ 发送验证邮件（Resend/QQ SMTP）
    └─ 返回"请查收邮件"
```

### Provider 调用

```
SearchService
    ↓
ProviderService.searchAll()
    ↓
活跃 Provider 列表（按 enabled 过滤）
    ↓
Promise.allSettled([
  PansouProvider.search()   // 5s 超时
  MagnetProvider.search()   // 5s 超时
  QuarkProvider.search()    // 5s 超时
])
    ↓
失败 Provider 返回空数组 + 日志告警
    ↓
结果合并 + URL 去重
    ↓
返回给 SearchService
```

## 数据库设计

详见 [prisma/schema.prisma](./apps/api/prisma/schema.prisma)。

核心表：

- `users` - 用户
- `user_preferences` - 用户偏好
- `invite_codes` - 邀请码（注册用）
- `membership_codes` - 会员激活码
- `search_history` - 搜索历史
- `search_logs` - 搜索日志（90 天保留）
- `favorites` - 收藏夹
- `link_status` - 失效链接状态
- `takedown_records` - 侵权举报
- `blocked_keywords` - 关键词黑名单
- `agreements` - 用户协议
- `user_agreements` - 协议同意记录
- `admin_audit_logs` - 管理员审计日志（1 年保留）

## 安全设计

- **认证**：JWT Access (15m) + Refresh (7d) + argon2 哈希
- **授权**：基于角色的访问控制（super_admin / user）
- **限流**：全局 + 搜索 + 登录 + 注册 + 密码重置
- **输入校验**：class-validator DTO
- **SQL 注入防护**：Prisma 参数化查询
- **XSS 防护**：Vue 模板转义 + sanitize-html
- **CSRF 防护**：JWT Bearer Token
- **HTTPS**：Caddy 自动申请 Let's Encrypt 证书
- **安全头**：CSP、X-Frame-Options、HSTS 等

## 合规设计

- **链接聚合**：只存链接 + 元数据，不存文件内容
- **takedown 流程**：24h 响应，记录到 `takedown_records`
- **关键词黑名单**：所有用户统一过滤
- **免责声明**：注册强制勾选 + 页脚常驻
- **用户协议**：版本化管理，记录同意历史
- **审计日志**：管理员操作全程可追溯

## 性能设计

- **缓存**：Redis 缓存热门搜索结果（1 小时 TTL）
- **并发**：Provider 并发搜索，单源超时不阻塞整体
- **失效链接检测**：BullMQ 异步任务，HEAD 请求 5s 超时
- **数据库索引**：高频查询字段建立索引
- **SSR**：Nuxt 3 服务端渲染，首屏快
- **静态资源**：Caddy gzip + zstd 压缩

## 可扩展性

- **Provider 插件化**：新增数据源只需实现 IProvider 接口
- **模块化**：NestJS 模块独立，便于维护
- **monorepo**：pnpm workspace，前后端共享类型
- **水平扩展**：v0.2+ 可拆分 worker 独立部署

## 部署架构

单机 Docker Compose 部署：

```yaml
services:
  caddy: # 反代 + HTTPS
  seekall-api: # NestJS
  seekall-web: # Nuxt 3 SSR
  mysql: # 数据库
  redis: # 缓存 + 队列
  meilisearch: # 全文检索
```

资源占用：~2GB 内存、~6GB 磁盘。
推荐配置：2C4G + 40GB SSD（最低），4C8G + 80GB SSD（舒适）。
