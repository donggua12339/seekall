# 觅源 SeekAll 项目路线图

> 最后更新：2026-07-28

---

## 里程碑总览

| 版本   | 日期          | 主题                                | 状态              |
| ------ | ------------- | ----------------------------------- | ----------------- |
| v0.1   | 2026-07-13    | MVP 骨架                            | ✅ 完成           |
| v0.2   | 2026-07-13    | 性能 + OAuth + API 开放             | ✅ 完成           |
| v0.3   | 2026-07-13~14 | 部署 + 开源 + 搜索增强              | ✅ 完成           |
| v0.4   | 2026-07-14~16 | TG/DHT/夸克 + AI 推荐               | ✅ 完成（已废弃） |
| v0.5   | 2026-07-18    | **完全重构**：SDK + 规则市场 + BaaS | ✅ 完成           |
| v0.5.x | 2026-07-19~27 | webhook + npm 发布 + user-spa + SEO | ✅ 完成           |
| v0.6   | 2026-07-22~28 | 留存体验 + 生态建设 + 搜索优化      | ✅ 完成           |
| v0.7   | 待定          | 搜索追平竞品                        | ⏳ 进行中         |
| v0.8   | 待定          | 社区生态 + 商业化                   | 📋 规划中         |
| v1.0   | 待定          | 稳定版                              | 📋 规划中         |

---

## v0.1 — MVP 骨架（2026-07-13）

- NestJS + Fastify + Prisma 后端
- Nuxt 3 SSR + Naive UI 前端
- Docker Compose + Caddy 反代
- 用户系统（注册/登录/邮箱验证/密码重置）
- 搜索聚合（PanSou API + 磁力站 + 网盘）
- 搜索历史 + 收藏夹
- 失效链接检测（BullMQ）
- 后台管理（用户/邀请码/审计日志）
- 邮件服务（Resend + QQ SMTP）
- 合规框架（takedown / 关键词黑名单 / 用户协议）

## v0.2 — 性能 + 开放（2026-07-13）

- 缓存分级 TTL + Provider 流式返回
- GitHub OAuth 登录
- API 开放（API Key 鉴权 + 限流）
- husky / eslint 修复 + Prisma 迁移 + 测试覆盖

## v0.3 — 部署 + 搜索增强（2026-07-13~14）

- 部署脚本 + 生产配置 + Sentry 监控
- 搜索建议 / 过滤 / 排序 / 快捷键 / 收藏夹分组
- 资源详情页 + 分享卡片
- 登录设备管理 + Provider 健康度评分
- API Key 权限细分 + Telegram Bot + 浏览器插件

## v0.4 — 数据源扩展（2026-07-14~16）

- TG 频道直连（tg-collector 服务）
- DHT 自爬（dht-crawler 服务）
- 夸克网盘转存（完整 API 逆向）
- AI 资源标签 + 推荐 + 关键词订阅 + 邮件通知
- 资源有效性投票 + 字幕搜索 + 下载队列（aria2）
- 资源合集 + PWA + 搜索历史时间线 + 封面图墙
- Provider 自动降级

> **注**：v0.4 的数据源扩展方向在 v0.5 重构时被完全废弃。原因：服务端直接爬取/接触资源内容导致合规风险集中，与"工具中性"定位冲突。

## v0.5 — 完全重构（2026-07-18）

**核心决策**：从"带搜索功能的 Nuxt Web 应用"转为"中立的规则引擎 SDK + 市场 + BaaS"。

- 砍掉 Nuxt 3 → VitePress 静态文档站
- 砍掉 19 个 API 模块 → 5 个（auth / user / admin / rule / license）+ health + dmca + search
- 砍掉 25+ 张数据库表 → 5 核心 + 4 辅助
- 新增 SDK 核心（`@seekall/sdk`）+ 3 个 L0 示例规则
- 新增 5 级风险评级 + 5 维权限矩阵
- 新增 DMCA §512(c) 合规流程 + 透明度报告
- 新增 WM 发卡网 webhook 半自动同步
- 新增 Admin SPA（Vue 3 + Naive UI）
- 新增邀请码系统 + 社群评审工作流

## v0.5.x — 上线后修复 + 扩展（2026-07-19~27）

### P1 上线修复

- WM webhook 3 bug 修复（@Public / DTO / Secret 配置）
- npm publish 6 包（SDK + 5 规则包）
- docs-site /health 路由 + GET /rules 校验

### P2 Quick Win（Kimi K3 报告）

- 限流（@nestjs/throttler）
- Swagger 生产收敛
- robots.txt
- Uptime 告警脚本
- 备份演练
- npm publish

### 功能扩展

- user-spa SaaS 级用户中心（14 页面）
- SDK CLI 完整命令集（7 命令）
- 性能差异化（tier-based concurrency + cache）
- 云同步（configs 表 + CLI sync）
- L2 tier 校验（防白嫖）
- CI/CD + 56 单元测试
- OpenAPI 在线文档
- 退款审核 UI
- 17 个 npm 规则包发布

## v0.6 — 留存体验 + 生态建设 + 搜索优化（2026-07-22~28）

### 第二波 P0

- blog 接入 docs-site（2 篇技术博客）
- 我的规则页（后端 /rules/my/submitted + npm 下载量）
- 贡献者徽章系统（admin 内联编辑 + Dashboard 展示）
- CLI bug fix（marketRules + EALLOWSCRIPTS）

### 第二波 P1

- 贡献者排行榜（raw SQL 聚合 + Top 3 颁奖台）
- 贡献者邀请文案（提交规则换终身会员）
- docs-site 首页改版（最新动态 + 代码示例）

### 第二波 P2

- SEO：sitemap + robots.txt + OG meta + Google/百度验证
- 规则分成积分系统（暂缓，等用户量）

### 注册 + 邮箱验证

- 注册直接 active（不再卡 pending_verification）
- 邮箱验证双模式（验证码 / 链接，admin 可切换）
- JWT guard 软认证（public 路由也解析 token）

### Admin 修复

- Dashboard 数据修复（deletedAt → status 查询）
- Analytics 合并到 Dashboard
- 路由守卫修复（去掉前端 isSuperAdmin 拦截）
- Admin nginx 反代修复（proxy_pass IP 错误 + 缺 /api/ location）

### 搜索优化 P0

- pansou 默认开启（加入 BASE_RULES）
- pansou 3 源并行（Promise.allSettled）
- 搜索免登录（@Public + 软认证）
- 搜索页独立路由 + 顶部导航栏
- 热搜词优化（6 → 12 个）

### License 链路修复

- redeem 返回格式修复（裸 User → {license, user}）
- BigInt 序列化安全处理
- 注册后跳转登录（不再自动登录）
- 邮件发送失败不阻断注册
- 僵尸 pending 用户自动清理

### SEO 内容

- 6 篇 SEO 文章（知乎 2 + CSDN 2 + dev.to 1 + Medium 1）
- 3 条小红书图文卡片
- 内容分发交接 prompt

---

## v0.7 — 搜索追平竞品（进行中）

### P1 搜索能力

- [x] pansou 加代理故障转移（2026-08-04：大陆微服务模式 CN_PANSOU_URL + 隧道故障转移 18787→18788/18789/18790→本地渲染兜底）
- [x] pansou 扩源（2026-08-04：2→4 源，新增猫狸盘搜/大力盘，实测 46 条结果。迅雷/天翼/UC 聚合站域名实测已死，无法接入）
- [x] 搜索结果加文件类型筛选（文件夹 / 文件）
- [ ] 搜索结果加时间范围筛选（今天 / 一周 / 一月 / 一年）（阻塞：各源不产时间戳）

### P2 运营内容

- [x] 首页热门资源榜（2026-08-05：MeiliSearch resources 索引 + GET /api/v1/resources/hot，搜索页 idle 态展示 top8）
- [x] 首页最新入库（2026-08-05：GET /api/v1/resources/latest，按 firstSeenAt 降序）
- [x] 热门搜索词从后端动态获取（2026-08-04：Redis ZSET + GET /api/v1/search/hot）

### P3 社区

- [ ] UGC 提交资源功能
- [ ] GitHub Discussions 开启

---

## v0.8 — 社区生态 + 商业化（规划中）

- [ ] 规则下载量积分系统（贡献者规则被下载 → 积分 → 兑换 license）
- [ ] 贡献者等级体系（青铜 / 白银 / 黄金 / 钻石）
- [ ] 规则质量评分（基于下载量 + 存活率 + 用户反馈）
- [ ] 规则版本管理（npm 版本同步 + 更新通知）
- [ ] 付费规则分成（规则作者获得订阅收入分成）

---

## v1.0 — 稳定版（规划中）

- [ ] 完整 API 文档（Redoc / Swagger UI 公网可访问）
- [ ] 性能监控（Prometheus + Grafana 或 Sentry Performance）
- [ ] 告警通道接入（Server酱 / 企业微信 / 邮件）
- [ ] 自动化测试覆盖率 ≥ 80%
- [ ] E2E 测试（Playwright / Cypress）
- [ ] 多语言支持（i18n：中文 + 英文）
- [ ] PWA 支持（Service Worker + 离线缓存）
- [ ] 移动端适配优化
- [ ] DMCA Agent 正式注册

---

## 关键指标目标

| 指标         | v0.6 当前   | v0.7 目标 | v1.0 目标 |
| ------------ | ----------- | --------- | --------- |
| npm 周下载量 | ~0          | > 50      | > 500     |
| GitHub Stars | 0 (private) | > 30      | > 200     |
| 注册用户     | 2           | > 50      | > 500     |
| 付费用户     | 1           | > 5       | > 50      |
| 社区规则     | 0           | > 2       | > 20      |
| 搜索源数     | 14          | 18+       | 25+       |
| 测试覆盖     | 56 tests    | 100+      | 200+      |
