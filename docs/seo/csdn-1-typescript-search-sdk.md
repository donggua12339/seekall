# TypeScript 搜索聚合 SDK 实战：100 行代码搭建自己的搜索引擎

> CSDN 技术博客体，目标搜索词：TypeScript 搜索引擎、搜索聚合 SDK、Node.js 搜索工具、开源搜索引擎开发、npm 搜索包

## 前言

如果你搜"TypeScript 搜索引擎"或"Node.js 搜索聚合"，大概率会搜到 ElasticSearch 客户端封装、Algolia SDK、或者各种爬虫框架。但如果你想要的是一个**轻量级的、可以在本机跑的搜索聚合 SDK**——不需要部署 ES 集群、不需要申请 Algolia 账号、搜索词不经过第三方——这篇就是你要的。

本文介绍 SeekAll SDK（`@seekall/sdk`），一个基于 TypeScript 的搜索规则引擎，用 100 行代码搭建你自己的搜索引擎。

## 核心概念

SeekAll 的架构很简单：

```
用户代码 → createEngine({ rules }) → engine.search(keyword)
                                        ↓
                              并发查询所有 rule
                                        ↓
                              结果汇总 + 去重
                                        ↓
                              返回 Hit[]
```

每个"规则"（Rule）就是一个实现了 `search` 方法的对象，封装了一个数据源的搜索逻辑。SDK 负责并发控制、超时、缓存、去重。

## 3 行代码跑起来

```bash
npm i @seekall/sdk @seekall/rule-arxiv @seekall/rule-crossref
```

```typescript
import { createEngine } from "@seekall/sdk";
import arxiv from "@seekall/rule-arxiv";
import crossref from "@seekall/rule-crossref";

const engine = createEngine({ rules: [arxiv, crossref] });
const hits = await engine.search("transformer");
hits.forEach((h) => console.log(`${h.title}\n  ${h.url}\n`));
```

输出：

```
Attention Is All You Need
  https://arxiv.org/abs/1706.03762

An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale
  https://arxiv.org/abs/2010.11929

...
```

## 写一个自定义规则（10 行代码）

```typescript
import type { Rule, Hit, RuleContext } from "@seekall/sdk";

export const githubRule: Rule = {
  name: "@my-org/rule-github",
  version: "0.1.0",
  riskLevel: "L1",

  async search(keyword: string, ctx: RuleContext): Promise<Hit[]> {
    const r = await ctx.fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(keyword)}&sort=stars`,
    );
    const data = await r.json();
    return (data.items || []).slice(0, 10).map((item: any) => ({
      title: item.full_name,
      url: item.html_url,
      snippet: item.description,
      meta: { stars: item.stargazers_count, lang: item.language },
    }));
  },
};
```

关键点：

- `ctx.fetch` 而不是 `fetch`——SDK 会根据你的 license tier 自动做并发控制和超时
- `riskLevel` 标记规则风险等级（L0 学术 / L1 开源 / L2 社区评审）
- 返回标准 `Hit[]` 格式，和其他规则的结果自动合并

## 完整示例：学术 + 开源混合搜索

```typescript
import { createEngine } from "@seekall/sdk";
import arxiv from "@seekall/rule-arxiv";
import crossref from "@seekall/rule-crossref";
import pubmed from "@seekall/rule-pubmed";
import { githubRule } from "./my-rules/github";

const engine = createEngine({
  rules: [arxiv, crossref, pubmed, githubRule],
});

const hits = await engine.search("diffusion model", {
  onHit: (hit) => {
    console.log(`[${hit.source}] ${hit.title}`);
    console.log(`  ${hit.url}`);
    if (hit.meta?.stars) console.log(`  ⭐ ${hit.meta.stars}`);
    console.log();
  },
});

console.log(`共 ${hits.length} 条结果`);
```

一次搜索，arxiv 论文 + crossref DOI + pubmed 文献 + GitHub 仓库全部出来。

## 性能配置

SeekAll 的性能是 tier-based 的：

```typescript
// 免费版：3 并发 + 10s 超时
const engine = createEngine({ rules: [...] })

// 付费版：10 并发 + 5s 超时 + 5min 缓存
const engine = createEngine({
  rules: [...],
  license: 'SA-MON-xxxx-xxxx'  // 月度 license code
})
```

| Tier           | 并发 | 超时 | 缓存 |
| -------------- | ---- | ---- | ---- |
| free           | 3    | 10s  | 无   |
| trial (¥1)     | 5    | 8s   | 无   |
| monthly (¥18)  | 10   | 5s   | 5min |
| lifetime (¥68) | 20   | 3s   | 5min |

## CLI 模式

不想写代码？SeekAll 提供了 CLI：

```bash
npx @seekall/sdk search "transformer attention"
npx @seekall/sdk rules list
npx @seekall/sdk config set defaultRules @seekall/rule-arxiv,@seekall/rule-github
npx @seekall/sdk whoami
```

## 规则市场

写完规则后发到 npm，提交到 SeekAll 规则市场（https://seekall.winmelon.cn/rules），其他人就能发现和使用你的规则。

已有的规则包：

| 包名                        | 数据源        | 风险等级 |
| --------------------------- | ------------- | -------- |
| `@seekall/rule-arxiv`       | arXiv         | L0       |
| `@seekall/rule-crossref`    | Crossref      | L0       |
| `@seekall/rule-pubmed`      | PubMed        | L0       |
| `@seekall/rule-github`      | GitHub Search | L1       |
| `@seekall/rule-hackernews`  | Hacker News   | L1       |
| `@seekall/rule-reddit`      | Reddit        | L2       |
| `@seekall/rule-producthunt` | Product Hunt  | L2       |
| `@seekall/rule-tmdb`        | TMDB          | L2       |

## 和 ElasticSearch / Algolia 的区别

|            | ElasticSearch | Algolia      | SeekAll            |
| ---------- | ------------- | ------------ | ------------------ |
| 部署       | 需要 ES 集群  | SaaS         | 无需部署（本机跑） |
| 数据源     | 自己灌数据    | 自己灌数据   | 规则自动拉取       |
| 搜索词隐私 | 经过 ES       | 经过 Algolia | 只在本机           |
| 成本       | 服务器费用    | $1/1000 次   | 免费（基础档）     |
| 适用场景   | 站内搜索      | 站内搜索     | 外部搜索聚合       |

SeekAll 不是替代品，是不同场景的工具。ES/Algolia 做站内搜索，SeekAll 做外部搜索聚合。

## 总结

TypeScript 搜索聚合 SDK，100 行代码搭建自己的搜索引擎：

1. `npm i @seekall/sdk` + 规则包
2. `createEngine({ rules })` 创建引擎
3. `engine.search(keyword)` 搜索
4. 自定义规则 10 行代码

GitHub：https://github.com/donggua12339/seekall
文档：https://seekall.winmelon.cn/sdk
npm：https://www.npmjs.com/package/@seekall/sdk

---

_标签：TypeScript, Node.js, 搜索引擎, SDK, 开源, npm, 搜索聚合, ElasticSearch 替代, 学术搜索_
