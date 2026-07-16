# SeekAll Provider 优化总结 v2

> 日期：2026-07-14
> 范围：Provider 稳健性 + 新增源 + 反爬 + 监控

## 一、新增功能清单

### P0（核心稳健性，已完成）

#### 1. 熔断器（Circuit Breaker）
- **文件**：`apps/api/src/common/utils/circuit-breaker.util.ts`
- **集成**：`apps/api/src/modules/provider/provider.service.ts`
- **行为**：
  - 连续失败 5 次熔断 30s（`CIRCUIT_BREAKER_FAILURE_THRESHOLD=5`）
  - 熔断期间请求直接跳过（不浪费超时时间）
  - 30s 后半开试探，成功恢复，失败重新熔断
- **效果**：避免持续打挂的源拖慢整体响应

#### 2. 多级 Fallback
- **文件**：`apps/api/src/modules/search/search.service.ts`
- **链路**：实时搜索 → Meilisearch 索引 → 相似关键词缓存
- **新增方法**：`searchSimilarKeyword()` - Level 2 fallback，从搜索日志找相似高频词的缓存

#### 3. URL + 标题 + SimHash 三级去重
- **文件**：`apps/api/src/common/utils/simhash.util.ts`
- **集成**：`provider.service.ts` 的 `deduplicate()` 方法
- **三级去重**：
  - L1: URL hash（精确去重）
  - L2: 标题 normalize（去装饰符号/质量标签/年份后比较）
  - L3: SimHash 汉明距离 ≤ 3（相似标题去重，如"三体" vs "【三体】第一季"）

#### 4. 定时预热索引（top 100）
- **文件**：`apps/api/src/modules/search/search.service.ts` + `workers/scheduled-tasks.service.ts`
- **变更**：预热 top 20 → top 100，串行 → 并发（每批 5 个）
- **效果**：缓存命中率提升，冷启动后 1 小时内覆盖 100 个高频词

#### 5. TG Bot 告警
- **文件**：`apps/api/src/modules/tg-alert/`（新模块）
- **事件**：
  - `provider:circuit-open` - Provider 熔断时推送
  - `search:high-zero-rate` - 10 分钟内 0 结果率 > 50% 推送
- **去重**：同一 Provider 30s 内只告警一次
- **配置**：`TG_ALERT_BOT_TOKEN` + `TG_ALERT_CHAT_ID`

### P1（实用性增强，已完成）

#### 6. 多 API 源 Provider
- **新增 Provider 1**：`PansouMirrorProvider`（`apps/api/src/modules/provider/providers/pansou-mirror/`）
  - 支持配置多个 PanSou 镜像（`PANSOU_MIRROR_URLS`）
  - 分散主 PanSou 单点依赖
- **新增 Provider 2**：`JackettProvider`（`apps/api/src/modules/provider/providers/jackett/`）
  - 对接自建 Jackett 服务（Torznab API，100+ 磁力站聚合）
  - 配置：`JACKETT_URL` + `JACKETT_API_KEY`

#### 7. 通用论坛爬虫框架
- **文件**：`apps/api/src/modules/provider/providers/forum/forum.provider.ts`（重构）
- **支持类型**：
  - `json` - 通用 JSON API（用 titleField/urlField 路径提取）
  - `reddit` - Reddit 特定格式（data.children[].data）
  - `rss` - RSS/Atom XML
  - `html` - HTML 正则提取
- **配置**：`FORUM_SITES`（JSON 数组，多站点并发搜索）

#### 8. 代理池 + 反爬工具
- **文件**：
  - `apps/api/src/common/utils/proxy-pool.util.ts` - 代理池（轮换/健康检查/剔除）
  - `apps/api/src/common/utils/anti-crawl.util.ts` - 随机 UA + 限速器 + 指数退避重试
- **配置**：`PROXY_POOL`（逗号分隔多代理）+ `PROXY_STRATEGY`（round-robin/random）
- **依赖**：Node 18+ 内置 undici ProxyAgent

#### 9. 搜索质量看板
- **接口**：`GET /api/v1/admin/search-quality`
- **指标**：
  - 0 结果率（1h/24h/7d）
  - 响应时间 P50/P95/avg
  - 热门 0 结果关键词（优化索引参考）

### P2（长期扩展，已完成框架）

#### 10. DHT 自爬独立服务
- **文件**：`services/dht-crawler/src/index.ts`
- **实现**：自研 Kademlia DHT 协议（KRPC + K-bucket 路由表）
- **运行**：`node services/dht-crawler/src/index.js`（独立进程）
- **数据流**：DHT 网络 → infohash 收集 → Meilisearch `dht-resources` 索引
- **状态**：框架完成，infohash 收集可用，元数据获取（ut_metadata）需后续完善

#### 11. TG Collector 对接
- **文件**：`services/tg-collector/src/index.ts`
- **功能**：监听 TG 频道消息，提取 10 类网盘链接 + 提取码，写入 Meilisearch `tg-resources` 索引
- **运行**：`node services/tg-collector/src/index.js`（独立进程）
- **配置**：`TG_API_ID` + `TG_API_HASH` + `TG_SESSION` + `TG_CHANNELS`
- **链接识别**：夸克/百度/阿里/迅雷/UC/115/磁力/PikPak/123/天翼

---

## 二、配置变更（.env 新增项）

```bash
# 镜像源
PANSOU_MIRROR_URLS=
PANSOU_MIRROR_TIMEOUT=4000

# Jackett
JACKETT_URL=
JACKETT_API_KEY=
JACKETT_TIMEOUT=5000

# 熔断器
CIRCUIT_BREAKER_FAILURE_THRESHOLD=5
CIRCUIT_BREAKER_COOLDOWN=30

# TG Bot 告警
TG_ALERT_BOT_TOKEN=
TG_ALERT_CHAT_ID=

# 论坛爬虫
FORUM_SITES=[]
FORUM_TIMEOUT=6000
FORUM_COOKIE=

# 代理池
PROXY_POOL=
PROXY_STRATEGY=round-robin
PROXY_MAX_FAILURES=3
PROXY_HEALTH_CHECK_INTERVAL=60

# TG Collector
TG_API_ID=
TG_API_HASH=
TG_SESSION=
TG_CHANNELS=
```

---

## 三、新目录结构

```
seekall/
├── apps/api/src/
│   ├── common/utils/
│   │   ├── circuit-breaker.util.ts      # 新增：熔断器
│   │   ├── simhash.util.ts              # 新增：SimHash 去重
│   │   ├── proxy-pool.util.ts           # 新增：代理池
│   │   └── anti-crawl.util.ts           # 新增：反爬工具
│   ├── modules/
│   │   ├── tg-alert/                    # 新增：TG Bot 告警模块
│   │   ├── provider/providers/
│   │   │   ├── pansou-mirror/           # 新增：PanSou 镜像 Provider
│   │   │   ├── jackett/                 # 新增：Jackett 聚合 Provider
│   │   │   └── forum/                   # 重构：多站点论坛爬虫
│   │   └── admin/
│   │       └── admin.service.ts         # 新增：searchQuality() 方法
│   └── workers/
│       └── scheduled-tasks.service.ts   # 新增：搜索质量监控定时任务
└── services/                            # 新增：独立服务目录
    ├── dht-crawler/                     # DHT 自爬服务
    │   ├── src/index.ts
    │   └── package.json
    └── tg-collector/                    # TG 频道收集器
        ├── src/index.ts
        └── package.json
```

---

## 四、Provider 矩阵

| Provider | 类型 | 启用条件 | 状态 |
|----------|------|----------|------|
| pansou | 网盘聚合 | 默认启用（POST 方式） | 稳定 |
| pansou-mirror | 网盘镜像 | `PANSOU_MIRROR_URLS` 非空 | 新增 |
| jackett | 磁力聚合 | `JACKETT_URL` + `JACKETT_API_KEY` 非空 | 新增 |
| magnet | 磁力 | `MAGNET_SITE_URL` 非空 | bt4g 被墙，待换源 |
| quark | 夸克网盘 | `PANSOU_API_URL` 非空 | 依赖 PanSou |
| tg-channel | TG 频道 | 默认启用 | 依赖 PanSou |
| tg-direct | TG 直连 | Meilisearch 可用 | 等 TG Collector 填充索引 |
| forum | 论坛 | `FORUM_SITES` 非空数组 | 新增多站点框架 |
| dht | DHT | Meilisearch 可用 | 等 DHT 爬虫填充索引 |

---

## 五、稳健性机制总览

### 搜索请求处理流程

```
用户搜索
  │
  ├── 1. 关键词黑名单校验
  │
  ├── 2. Redis 缓存查询（命中直接返回）
  │
  ├── 3. Provider 并发搜索
  │     ├── 熔断器检查（open 状态跳过）
  │     ├── 4s 超时（单 Provider）
  │     ├── 失败记录 + 熔断器更新
  │     └── 成功记录 + 熔断器重置
  │
  ├── 4. 三级去重（URL → 标题 → SimHash）
  │
  ├── 5. 失效链接过滤
  │
  ├── 6. AI 资源标签
  │
  ├── 7. fileType 过滤 + 排序 + 分页
  │
  ├── 8. 0 结果 Fallback
  │     ├── L1: Meilisearch 索引
  │     └── L2: 相似关键词缓存
  │
  ├── 9. 分级 TTL 缓存（热门 1h / 长尾 10min）
  │
  ├── 10. 异步写入 Meilisearch 索引
  │
  └── 11. 异步写入搜索日志
```

### 监控告警

```
定时任务（每 5 分钟）
  │
  ├── 搜索 0 结果率 > 50% → TG 告警
  │
  └── Provider 熔断事件（实时） → TG 告警（30s 去重）
```

---

## 六、后续优化建议

1. **自建 PanSou 实例**：部署到香港服务器，`PANSOU_MIRROR_URLS` 指向自建实例
2. **部署 Jackett**：`docker run -d -p 9117:9117 linuxserver/jackett`，配置 `JACKETT_URL` + `JACKETT_API_KEY`
3. **启动 TG Collector**：填写 `TG_API_ID/HASH`，首次运行保存 `TG_SESSION`
4. **启动 DHT 爬虫**：`cd services/dht-crawler && pnpm install && pnpm start`
5. **配置论坛站点**：`FORUM_SITES` 填入 JSON 数组（V2EX/Reddit/RSS 站点）
6. **购买代理池**：`PROXY_POOL` 填入代理列表，论坛爬虫自动使用
7. **DHT 元数据获取**：实现 ut_metadata 协议（当前仅收集 infohash，无标题）
8. **浏览器自动化**：对反爬严格的论坛站点，用 Playwright 模拟真实访问
