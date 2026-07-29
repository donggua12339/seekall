# 觅源 SeekAll 任务清单

> 最后更新：2026-07-28 | 当前版本：v0.6

---

## 状态说明

- ✅ 已完成
- 🔧 进行中
- ⏳ 待做
- ⏸️ 暂缓（等前置条件）
- ❌ 已取消

---

## 已完成（v0.5 ~ v0.6）

### 基础设施

- ✅ Docker Compose 7 容器部署（api / admin / user-spa / docs-site / mysql / redis / meilisearch）
- ✅ 主机 nginx 反代 + Let's Encrypt 通配符证书
- ✅ SSL 证书 SAN 扩展（seekall / admin / user 三域名）
- ✅ Redis 持久化修复（--dir /data + chown redis:redis）
- ✅ Admin nginx 反代修复（proxy_pass IP + /api/ location）
- ✅ User-spa nginx /api/ 反代
- ✅ dht-meilisearch 遗留容器 IP 冲突解决
- ✅ CI/CD 5 job 流水线（lint / test-api / test-sdk / build-frontends / build-api）
- ✅ 每日 3 点 MySQL + Redis 备份 cron
- ✅ Uptime 监控脚本（6 项检查 / 5 分钟）

### 后端

- ✅ 5 核心 + 4 辅助表 Prisma schema
- ✅ JWT 认证（Access 15min + Refresh 7d + argon2）
- ✅ 全局限流（@nestjs/throttler 100/min）
- ✅ 认证端点限流（login 5/min / register 3/min）
- ✅ WM webhook 全链路（签名验证 + 幂等 + cardContent 支持）
- ✅ 注册直接 active + 邮箱验证双模式（code / link）
- ✅ JWT guard 软认证（public 路由也解析 token）
- ✅ 搜索免登录（@Public + 软认证）
- ✅ redeem 返回格式修复（{license, user} + BigInt 安全序列化）
- ✅ 僵尸 pending 用户自动清理
- ✅ 邮件发送失败不阻断注册
- ✅ L2 tier 校验（防 trial 白嫖）
- ✅ 贡献者排行榜 API（raw SQL 聚合）
- ✅ Admin 邮箱验证模式切换 API
- ✅ Dashboard 数据修复 + Analytics 合并
- ✅ 退款审核 API（list / approve / reject）
- ✅ 用户交易记录 + 收据申请 + 退款申请 API
- ✅ 云同步 API（GET/POST /user/sync）

### 搜索

- ✅ greenhub 11 源并行 HTTP 搜索 + 代理故障转移
- ✅ pansou 3 源无头浏览器搜索（夸克 + UP云搜 + 阿里云盘搜）
- ✅ pansou 默认开启 + 3 源并行化（串行 → Promise.allSettled）
- ✅ pansou 超时优化（30s → 15s）
- ✅ 搜索结果去重 + 域名聚合统计

### 前端 - Admin SPA

- ✅ 登录 + Dashboard + 用户管理 + License 管理
- ✅ DMCA 举报管理（列表 + 详情 + 处理）
- ✅ 规则评审
- ✅ 退款审核
- ✅ 审计日志
- ✅ 数据分析（已合并到 Dashboard）
- ✅ 系统设置（邮箱验证模式切换）

### 前端 - User SPA

- ✅ 注册 + 登录 + 邮箱验证页
- ✅ Dashboard（会员状态 + 徽章 + 未验证横幅）
- ✅ 搜索页（全屏 + 免登录 + 导航栏 + 12 热搜词）
- ✅ 插件市场页（搜索 + 风险筛选 + 订阅/取消 + npm 下载量）
- ✅ 我的规则页（提交列表 + 状态 + npm 下载量）
- ✅ 提交规则页
- ✅ 我的 License 页（激活 + 邀请码生成）
- ✅ 我的订阅页
- ✅ 交易记录 + 收据申请 + 续费 + 退款申请
- ✅ DMCA 举报页
- ✅ 账号设置页

### 前端 - Docs Site

- ✅ VitePress 文档站（指南 + SDK + 规则市场 + 合规 + API）
- ✅ Blog（2 篇技术博客）
- ✅ 贡献者排行榜页 + 邀请计划页
- ✅ 首页改版（最新动态 + 代码示例 + GitHub/npm 双入口）
- ✅ SEO（sitemap + robots.txt + OG meta）
- ✅ Google Search Console + 百度站长平台验证

### SDK + 规则包

- ✅ @seekall/sdk 核心（createEngine + Rule 接口 + Hit 类型）
- ✅ CLI 完整命令集（search / license / sync / rules / config / whoami / init）
- ✅ 性能差异化（tier-based concurrency + timeout + cache）
- ✅ 17 个规则包发布到 npm（6 L0 + 4 L1 + 7 L2）

### 运维 + 合规

- ✅ WM webhook 全链路闭环（含 cardContent）
- ✅ DMCA §512(c) 合规流程 + 透明度报告
- ✅ 5 条红线执行（代码 grep 验证）
- ✅ Swagger 生产收敛
- ✅ Sentry 5xx 上报

### 内容 + SEO

- ✅ 6 篇 SEO 文章（知乎 2 + CSDN 2 + dev.to 1 + Medium 1）
- ✅ 3 条小红书图文卡片
- ✅ 内容分发交接 prompt（docs/content-publish-handoff.md）

### 文档

- ✅ spec.md 项目规约
- ✅ plan.md 项目路线图
- ✅ tasks.md 任务清单（本文件）
- ✅ CLAUDE.md 项目宪章
- ✅ ARCHITECTURE.md 架构设计
- ✅ CONTRIBUTING.md 贡献指南
- ✅ CHANGELOG.md 变更日志

---

## 待做（v0.7）

### 搜索能力

- ⏳ pansou 加代理故障转移（HK → 大陆代理）
- ⏳ pansou 加百度网盘源
- ⏳ pansou 加迅雷云盘源
- ⏳ pansou 加天翼云盘源
- ⏳ pansou 加 UC 网盘源
- ⏳ 搜索结果加文件类型筛选（文件夹 / 文件）
- ⏳ 搜索结果加时间范围筛选（今天 / 一周 / 一月 / 一年）

### 运营内容

- ⏳ 首页热门资源榜（50 条）
- ⏳ 首页最新入库（50 条）
- ⏳ 热门搜索词后端动态获取
- ⏳ GitHub Discussions 开启（Settings → Discussions → Enable）

### 需用户操作

- ⏳ GSC 提交 sitemap.xml
- ⏳ 百度手动提交 24 URL
- ⏳ 内容营销发布（6 篇文章 + 3 条小红书）
- ⏳ DMCA Agent 注册（等用户量）

---

## 待做（v0.8）

- ⏳ 规则下载量积分系统
- ⏳ 贡献者等级体系
- ⏳ 规则质量评分
- ⏳ 规则版本管理（npm 版本同步）
- ⏳ 付费规则分成

---

## 待做（v1.0）

- ⏳ 完整 API 文档公网可访问
- ⏳ 性能监控（Prometheus + Grafana）
- ⏳ 告警通道接入
- ⏳ 测试覆盖率 ≥ 80%
- ⏳ E2E 测试
- ⏳ 多语言 i18n
- ⏳ PWA 支持
- ⏳ 移动端适配优化

---

## 已取消

- ❌ PanSou 自建实例（v0.4.1 遗留，v0.5 不再调用）
- ❌ TG Collector / DHT Crawler（v0.4.1 遗留，v0.5 转 SDK 后作废）
- ❌ Nuxt 3 SSR 前端（v0.5 砍掉，改 VitePress + Admin SPA + User SPA）
- ❌ Caddy 反代（改 nginx）
- ❌ GitHub OAuth（v0.5 暂时移除）
- ❌ 浏览器插件（v0.5 暂时移除）
