---
title: 如何用 100 行代码构建自己的搜索聚合工具
description: 用 SeekAll SDK + 100 行代码搭一个属于自己的搜索聚合工具，规则自己写，数据本机跑，服务端零接触。
date: 2026-07-21
---

# 如何用 100 行代码构建自己的搜索聚合工具

> 做学术研究、技术调研时，你还在 arxiv、crossref、pubmed 之间来回切吗？同一个关键词复制粘贴 3 遍。本文教你用 SeekAll SDK + 100 行代码搭一个属于自己的搜索聚合工具，规则自己写，数据本机跑，服务端零接触。

## 痛点：信息散落在多个孤岛

做学术研究或技术调研时，我经常遇到这样的场景：

- 搜一个论文关键词，要去 arxiv 看预印本、crossref 看 DOI 元数据、pubmed 看生物医学
- 搜一个技术栈，要去 GitHub 看仓库、Hacker News 看讨论、Stack Overflow 看问答
- 同一个关键词，要在 3-5 个网站之间复制粘贴，结果还散落在不同标签页

市面上的"xxx 聚合搜索"网站要么是套壳搜索引擎、要么塞满了广告、要么数据源单一。更关键的是——**你的搜索词会经过别人的服务器**，隐私和合规都是黑盒。

我想要的是一个：

1. **规则可自定义**：我想搜什么源，自己写规则
2. **数据本机跑**：搜索词不经过任何中间服务器
3. **工具中性**：平台本身不提供任何默认数据源，避免合规风险

于是我做了 **SeekAll**——一个规则引擎 SDK + 规则市场 + BaaS，默认 0 规则，所有规则在用户本机跑。

## 3 行代码跑起来

```bash
npm i @seekall/sdk @seekall/rule-arxiv @seekall/rule-crossref
```

```typescript
import { createEngine } from "@seekall/sdk";
import arxiv from "@seekall/rule-arxiv";
import crossref from "@seekall/rule-crossref";

const engine = createEngine({ rules: [arxiv, crossref] });
const hits = await engine.search("transformer attention mechanism");
hits.forEach((h) => console.log(`${h.title}\n  ${h.url}\n`));
```

就这么简单。`createEngine` 接收一个规则数组，`engine.search` 并发查询所有规则，返回统一的 `Hit[]` 结构。搜索词只在你本机的 Node 进程里跑，SeekAll 的服务端**零接触**你的搜索内容。

## 手把手：写一个 GitHub Trending 规则（10 行代码）

SeekAll 的核心是"规则"。一个规则就是一个实现了 `Rule` 接口的对象，最核心的方法是 `search`：接收关键词 + 上下文，返回 `Hit[]`。

我们以 GitHub Trending 为例，写一个 10 行代码的规则：

```typescript
import type { Rule, Hit, RuleContext } from "@seekall/sdk";

export const githubTrendingRule: Rule = {
  name: "@my-org/rule-github-trending",
  version: "0.1.0",
  riskLevel: "L1", // L0 学术纯净 / L1 通用开源 / L2 社区评审 / L3-L4 高风险

  async search(keyword: string, ctx: RuleContext): Promise<Hit[]> {
    const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(keyword)}&sort=stars&order=desc`;
    const r = await ctx.fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "SeekAll/0.5",
      },
    });
    const data = await r.json();
    return (data.items || []).slice(0, 10).map((item: any) => ({
      title: item.full_name,
      url: item.html_url,
      snippet: item.description,
      meta: { stars: item.stargazers_count, language: item.language },
    }));
  },
};
```

这就是一个完整的规则。核心要点：

1. **`name`**：规则的唯一标识，npm 包名格式
2. **`riskLevel`**：风险评级，SeekAll 用 5 级评级（L0-L4），L0 是 arxiv/crossref 这种学术纯净源，L1 是 GitHub 这种通用开源，L3/L4 是高风险源（仅 admin 可见，永不公开）
3. **`search`**：异步函数，接收关键词 + 上下文，返回 `Hit[]`
4. **`ctx.fetch`**：规则用 SDK 提供的 `ctx.fetch` 而非直接 `fetch`，这样 SDK 能统一做并发控制、超时、缓存

**为什么用 `ctx.fetch` 而不是 `fetch`？** 因为 SeekAll 的性能是 tier-based 的：

| Tier                 | 并发 | 超时 | 缓存 |
| -------------------- | ---- | ---- | ---- |
| free                 | 3    | 10s  | 无   |
| trial (¥1/7天)       | 5    | 8s   | 无   |
| monthly (¥18/30天)   | 10   | 5s   | 5min |
| lifetime (¥68/100年) | 20   | 3s   | 5min |

`ctx.fetch` 会根据你的 license tier 自动限流 + 缓存，规则代码本身不需要关心这些。

## 发布规则到 npm + 提交到 SeekAll 市场

写完规则后，两步让它被其他人用：

### 1. 发布到 npm

```bash
# 在规则包目录
pnpm build
npm publish --access public
```

规则就是一个普通的 npm 包，任何人 `npm i @your-org/rule-xxx` 就能装。

### 2. 提交到 SeekAll 规则市场

SeekAll 有一个规则市场（https://seekall.winmelon.cn/rules），用户可以在市场上浏览 + 订阅规则。提交流程：

1. 在 SeekAll 注册账号
2. 在规则市场点"提交规则"
3. 填写规则名、npm 包名、风险评级、描述
4. 等待社区评审（L0-L2）或 admin 终审（L3-L4）
5. 通过后规则出现在市场列表，其他用户可以订阅

**重要**：SeekAll 的规则市场**不托管规则代码**，只做列表 + 订阅。规则代码在 npm 上，用户装的时候直接从 npm 拉。这样 SeekAll 服务端零接触资源内容，保持工具中性。

## 5 级风险评级：工具中性的设计哲学

SeekAll 最核心的设计是 **5 级风险评级**：

| 级别 | 说明     | 可见性             | 示例                                |
| ---- | -------- | ------------------ | ----------------------------------- |
| L0   | 学术纯净 | 公开               | arxiv, crossref, pubmed             |
| L1   | 通用开源 | 公开               | GitHub, Hacker News, Stack Overflow |
| L2   | 社区评审 | 公开（需评审通过） | 特定社区 API                        |
| L3   | 高风险   | 仅 admin 可见      | 灰色地带资源站                      |
| L4   | 极高风险 | 仅 admin 可见      | 永不公开                            |

**为什么这样设计？** 因为工具本身是中性的，但数据源不是。一把刀可以切菜也可以伤人，SeekAll 选择做"刀"而不是做"菜刀店"——我们提供引擎，你来决定搜什么。

- L0-L2 规则公开，任何人可以装
- L3-L4 规则永远不对非 admin 可见，即使付费也不行
- 服务端不调资源站（`apps/api/src/modules/rule/` 里没有 `axios`/`fetch`/`http`），所有请求在用户本机发出

这意味着 SeekAll 作为一个平台，**不接触任何资源内容**。合规边界清晰。

## 性能差异化：免费够用，付费加速

SeekAll 是商业模式的项目，不是纯开源。SDK 核心 AGPL-3.0 开源，但性能差异化需要 license：

- **free**：3 并发 + 10s 超时，适合轻度使用
- **trial ¥1/7天**：5 并发 + 8s 超时，体验完整功能
- **monthly ¥18/30天**：10 并发 + 5s 超时 + 5min 缓存，重度使用
- **lifetime ¥68/100年**：20 并发 + 3s 超时 + 5min 缓存，一次买断

License 通过 WM 发卡网卖（卡密 + webhook 激活），不集成支付 SDK。

**为什么不完全免费？** 因为规则市场的运营（评审、takedown、DMCA 处理）需要成本。付费门槛也能过滤掉一部分滥用。

## 总结：100 行代码，属于自己的搜索聚合工具

完整代码回顾：

```typescript
// 1. 引入 SDK + 规则
import { createEngine } from "@seekall/sdk";
import arxiv from "@seekall/rule-arxiv";
import crossref from "@seekall/rule-crossref";
import { githubTrendingRule } from "./my-rules/github-trending"; // 你自己写的

// 2. 创建引擎
const engine = createEngine({
  rules: [arxiv, crossref, githubTrendingRule],
});

// 3. 搜索
const hits = await engine.search("transformer attention mechanism");

// 4. 处理结果
hits.forEach((h) => {
  console.log(`[${h.source}] ${h.title}`);
  console.log(`  ${h.url}`);
  console.log(`  ${h.snippet?.slice(0, 100)}`);
  console.log();
});
```

算上你自己写的 GitHub Trending 规则（10 行），总共也就 30 行核心代码。加上错误处理、结果去重、输出格式化，100 行足够搭一个属于自己的搜索聚合工具。

**和"xxx 聚合搜索"网站的区别**：

|              | 聚合搜索网站       | SeekAll                      |
| ------------ | ------------------ | ---------------------------- |
| 搜索词经过谁 | 网站服务器         | 只在你本机                   |
| 数据源       | 网站内置，你选不了 | 你自己写规则，想搜什么搜什么 |
| 合规         | 网站承担           | 工具中性，平台零接触         |
| 可扩展       | 等网站更新         | npm 发包，社区贡献           |

## CTA

- **GitHub**：https://github.com/donggua12339/seekall 欢迎 star
- **文档站**：https://seekall.winmelon.cn/sdk
- **规则市场**：https://seekall.winmelon.cn/rules
- **¥1 试用**：7 天体验完整功能，通过 WM 发卡网购买

如果你也在做学术研究、技术调研，厌倦了在多个网站之间来回切，想搭一个属于自己的搜索聚合工具，SeekAll 是目前最中性的选择。规则自己写，数据本机跑，服务端零接触。

---

_本文是 SeekAll 系列教程的第一篇。下一篇会讲"为什么我不做搜索网站，只做 SDK"——聊聊工具中性的设计哲学。_
