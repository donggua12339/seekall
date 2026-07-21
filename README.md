# SeekAll - 规则引擎 SDK + 市场

> 中立的搜索规则 SDK + 市场。规则在你机器上跑,服务端零接触资源。

[![npm version](https://img.shields.io/npm/v/@seekall/sdk.svg)](https://www.npmjs.com/package/@seekall/sdk)
[![npm downloads](https://img.shields.io/npm/dw/@seekall/sdk.svg)](https://www.npmjs.com/package/@seekall/sdk)
[![License: AGPL-3.0](https://img.shields.io/badge/SDK-AGPL--3.0-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](#)
[![GitHub stars](https://img.shields.io/github/stars/donggua12339/seekall?style=social)](https://github.com/donggua12339/seekall)

**如果觉得有用,给个 ⭐ Star 支持一下!**

## 快速开始

```bash
# 一行命令搜索(默认带 3 个 L0 学术规则: arxiv + crossref + pubmed)
npx @seekall/sdk search transformer
```

```bash
# 安装到项目
npm i @seekall/sdk

# 初始化新项目(脚手架)
npx @seekall/sdk init my-app
```

## 它是什么

- 一个 npm 包: `npm i @seekall/sdk`
- 一个规则市场: [seekall.winmelon.cn/rules](https://seekall.winmelon.cn/rules/)
- 一个 BaaS: 账号、规则订阅、付费授权
- 一个用户中心: [user.seekall.winmelon.cn](https://user.seekall.winmelon.cn)

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

SDK 在你机器上跑所有规则 -> 汇总去重 -> 返回结果给你。
服务端只负责账号、规则市场列表、DMCA 邮箱。

## CLI 命令

```bash
seekall search <keyword>           # 搜索(默认 3 个 L0 规则)
seekall license redeem <code>      # 激活 license
seekall sync                       # 同步云端订阅 + 配置
seekall rules list                 # 列出可用规则
seekall rules install <pkg>        # 安装规则包
seekall config set license <code>  # 配置 license
seekall whoami                     # 查看 license 信息
seekall init [name]                # 初始化项目
```

## 风险评级(5 级)

| 级别 | 含义                                   | 可见性   |
| ---- | -------------------------------------- | -------- |
| L0   | 学术纯净(arxiv / crossref / pubmed)    | 所有人   |
| L1   | 通用开源(GitHub / Hacker News)         | 所有人   |
| L2   | 付费独享(开发者热点 / 文娱 / 学术增强) | 付费会员 |
| L3   | 高风险                                 | 仅 admin |
| L4   | 严重侵权源                             | 仅 admin |

## 会员(不强制)

| 档位     | 价格 | 时长   | 权限                    |
| -------- | ---- | ------ | ----------------------- |
| trial    | ¥1   | 7 天   | L0-L1 订阅              |
| monthly  | ¥18  | 30 天  | L0-L2 + 评审权 + 邀请码 |
| lifetime | ¥68  | 100 年 | 同 monthly              |

购买: [WM 发卡网](https://winmelon.cn) -> 兑换码 -> `seekall license redeem <code>`

## 可用规则(18 个 npm 包)

**L0 学术(免费)**: arxiv / crossref / pubmed

**L1 通用(免费)**: github / hackernews

**L2 付费独享(11 个)**:

- 开发者热点: reddit / producthunt / github-trending / hackernews-trending
- 文娱: tmdb / omdb / lastfm / igdb
- 学术增强: arxiv-trending / openalex / semantic-scholar

浏览全部: [规则市场](https://seekall.winmelon.cn/rules/)

## 文档

- **指南**: [seekall.winmelon.cn/guide/](https://seekall.winmelon.cn/guide/getting-started)
- **SDK 文档**: [seekall.winmelon.cn/sdk/](https://seekall.winmelon.cn/sdk/)
- **API 文档**: [seekall.winmelon.cn/api/](https://seekall.winmelon.cn/api/)
- **合规**: [seekall.winmelon.cn/compliance/](https://seekall.winmelon.cn/compliance/)

## 贡献

- 写规则: [规则作者指南](https://seekall.winmelon.cn/rules/author-guide)
- 提交规则: `seekall rules submit` 或 [用户中心](https://user.seekall.winmelon.cn)
- 反馈: [GitHub Discussions](https://github.com/donggua12339/seekall/discussions)

## License

- SDK 核心: AGPL-3.0
- 规则插件: MIT
