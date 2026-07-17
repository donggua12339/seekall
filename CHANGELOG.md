# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/zh-CN/spec/v2.0.0.html).

## [Unreleased]

## [0.4.1] - 2026-07-16

### Added
- AI 资源标签（基于标题规则匹配自动分类）
- AI 资源推荐（基于搜索历史 + Meilisearch 相似度）
- 关键词订阅 + 邮件通知（每 2 小时检查）
- 资源有效性投票（群体智慧维护）
- 字幕搜索（对接 OpenSubtitles API）
- 字幕配置教程（docs/SUBTITLE-GUIDE.md）
- 下载队列（对接 aria2 JSON-RPC）
- 资源合集（主题合集 + 资源管理）
- PWA 支持（manifest + theme-color）
- 搜索历史时间线（日期分组时间轴）
- 资源封面图墙（Netflix 风格 grid）
- Provider 自动降级（健康度 < 30 禁用，> 70 恢复）
- 快捷键帮助面板 + 主题切换按钮

## [0.4.0] - 2026-07-14

### Added
- TG 频道直连（独立 tg-collector 服务）
- 资源论坛 Provider（通用框架）
- DHT 自爬（独立 dht-crawler 服务）
- 夸克网盘转存（完整 API 逆向）
- 自定义 Provider 插件文档

## [0.3.3] - 2026-07-14

### Added
- API Key 权限细分（scopes）
- Telegram Bot
- 浏览器插件

## [0.3.2] - 2026-07-14

### Added
- 资源详情页 + 分享卡片
- 登录设备管理
- Provider 健康度评分
- 用户行为分析面板

## [0.3.1] - 2026-07-13

### Added
- 搜索建议/过滤/排序/快捷键/收藏夹分组

## [0.3.0] - 2026-07-13

### Added
- 部署脚本 + 生产配置 + 部署文档
- 开源文档（README/CONTRIBUTING/Issue模板）
- Sentry 监控配置

## [0.2.0] - 2026-07-13

### Added
- 性能优化（缓存分级 TTL + Provider 流式返回）
- GitHub OAuth 登录
- API 开放（API Key 鉴权 + 限流）

### Changed
- husky/eslint 修复 + Prisma 迁移 + 测试覆盖率达标

## [0.1.0] - 2026-07-13

### Added
- MVP 骨架
  - 后端 NestJS + Fastify + Prisma
  - 前端 Nuxt 3 SSR + Naive UI + Pinia
  - Docker Compose 部署配置
  - Caddy 反向代理 + 自动 HTTPS
  - Prisma schema 设计
  - Provider 插件框架
  - 用户系统（注册/登录/邮箱验证/密码重置）
  - 邀请码 + 会员激活码系统
  - 搜索聚合（PanSou API + 磁力站 + 网盘）
  - 搜索历史 + 收藏夹
  - 失效链接检测（BullMQ 定时任务）
  - 后台管理（用户列表/邀请码生成/审计日志）
  - 邮件服务（Resend + QQ SMTP）
  - 完整合规框架（takedown / 关键词黑名单 / 用户协议）

## [Unreleased - 2026-07-17 部署修复]

### Fixed
- index.vue 多行 `@click` 模板语法错误 → Nuxt 全路由渲染失败（commit 47a9022）
- Prisma schema VarChar(2048) 复合 unique 索引超 3072 字节 → 改为前缀索引 (length: 255)
- Docker alpine 镜像缺少 OpenSSL → Prisma engine 启动失败
- Prisma engines 目录写权限 → COPY 加 --chown=nestjs:nodejs
- esbuild pnpm store 残留版本错配 → 改用 npmmirror + node-linker hoisted
- WM 发卡网占 80/443 → SeekAll Caddy 改 8080/8443
- redis / mysql 数据卷 bind mount 权限问题 → 改命名卷 + 健康检查 fix
- 容器重启 IP 漂移 → seekall-api seekall-web 固定 172.18.0.5 172.18.0.6

### Changed
- docker-compose.yml 移除 Caddy 中转层（nginx on host 直连容器）
- nginx 加 Cross-Origin-* 安全头（COOP/CORP/COEP）+ 隐藏 x-powered-by
- nginx 加 1 年 immutable 静态资源缓存
- HTTPS 改由上游 nginx 终止（HSTS / 通配符证书）

### Added
- HK 服务器 cron 每天 3 点自动备份 MySQL + Redis + Meilisearch
  （scripts/backup-cron.sh，保留 30 天）
- admin 账号远程初始化工具（scripts/setup-admin.py）
- tg-collector / dht-crawler 部署骨架（待 TG Bot Token）
- docker-compose 关键服务固定 IP（重启不漂移）
- 部署运维脚本集合（deploy + rsync + cert + backup）

### Security
- 自签证书（*.winmelon.cn 通配符）已替换 nginx 配置
- 静态资源 1 年 immutable 缓存 + 隐藏技术栈指纹（x-powered-by）
