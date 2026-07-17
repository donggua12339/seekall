# SeekAll — 网盘 / 磁力聚合搜索的规则引擎

> 中立的搜索规则 SDK + 市场。规则在你机器上跑，服务端零接触资源。

[![License: AGPL-3.0](https://img.shields.io/badge/SDK-AGPL--3.0-blue.svg)](LICENSE)
[![License: MIT](https://img.shields.io/badge/Plugins-MIT-green.svg)](LICENSE.plugins)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](#)

## 它是什么

- 一个 npm 包：`npm i @seekall/sdk`
- 一个规则市场：[rules.seekall.winmelon.cn](https://rules.seekall.winmelon.cn)
- 一个 BaaS：账号、规则订阅、付费授权

## 它不是

- ❌ 不是网盘搜索网站
- ❌ 不是盗版资源下载工具
- ❌ 不内置任何指向具体网盘 / 磁力站 / 盗版论坛的默认规则

## 工作方式

```bash
npm i @seekall/sdk @seekall/rule-arxiv
```

```ts
import { createEngine } from "@seekall/sdk";
import arxiv from "@seekall/rule-arxiv";

const engine = createEngine({ rules: [arxiv] });
const hits = await engine.search("transformer");
```

SDK 在你机器上跑所有规则 → 汇总去重 → 返回结果给你。
服务端只负责账号、规则市场列表、DMCA 邮箱。

## 风险评级（5 级）

| 级别 | 含义                                  | 可见性               |
| ---- | ------------------------------------- | -------------------- |
| L0   | 学术纯净（arxiv / crossref / pubmed） | 所有人               |
| L1   | 官方 API                              | 所有人               |
| L2   | 混搜警告（聚合型资源站）              | 会员可见             |
| L3   | 高风险（论坛 / 网盘类）               | admin 可见，仅作审计 |
| L4   | 严重侵权源                            | admin 可见，仅作审计 |

5 维权限矩阵（View / Run / Save / Upload / Author）严格映射会员档，详见 [文档](apps/docs-site/guide/permission-matrix.md)。

## 会员（不强制）

| 档位 | 价格 | 时长  | 权限                          |
| ---- | ---- | ----- | ----------------------------- |
| 免费 | ¥0   | 永久  | L0-L1 规则                    |
| 试用 | ¥1   | 7 天  | L0-L2 规则（每账号限购 1 次） |
| 月卡 | ¥18  | 30 天 | L0-L2 + 上传规则（5 条/月）   |
| 永久 | ¥68  | 永久  | L0-L3 + 上传规则 + 作者徽章   |

主推永久。¥1 试用每月可发 3 个邀请码（防羊毛）。

## 协议

- SDK 核心：AGPL-3.0（强 copyleft）
- 插件：MIT（宽松，鼓励社区贡献）
- 服务端 BaaS：BUSL（商业源码许可）

## 合规

- 站点零接触盗版源（规则在你机器跑）
- L3/L4 规则仅 admin 可见，仅作审计
- DMCA 邮箱：`1660069758@qq.com`（24h 内人工响应）
- Takedown 透明度报告每月发布

## 文档

完整文档在 [apps/docs-site/](apps/docs-site/)（vitepress 静态站）：

- [快速开始](apps/docs-site/guide/getting-started.md)
- [它是什么](apps/docs-site/guide/what-is-seekall.md)
- [5 级风险评级](apps/docs-site/guide/risk-levels.md)
- [5 维权限矩阵](apps/docs-site/guide/permission-matrix.md)
- [SDK 接口](apps/docs-site/sdk/rule-interface.md)
- [合规框架](apps/docs-site/compliance/index.md)

## 开发

```bash
pnpm install
pnpm dev          # 启动 API + docs-site
pnpm build       # 构建
pnpm test        # 测试
pnpm lint         # 代码检查
```

## 项目状态

v0.5 重构中（Sprint 4 周，详见交接手册）。
v0.4.1 已归档为 `v0.4.1-archive` git tag。

## License

- SDK 核心：[AGPL-3.0](LICENSE)
- 插件：MIT（见各插件包内 LICENSE）
