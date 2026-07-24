# Building a Search Aggregator SDK in TypeScript (Open Source)

> dev.to / Medium 英文技术博客，目标搜索词：open source search SDK, TypeScript search aggregator, build your own search engine, npm search package, search API aggregation

## The Problem

When you're doing research or technical investigation, you end up searching the same keyword across arXiv, GitHub, Hacker News, Crossref, PubMed — copying and pasting between 5 tabs, manually deduplicating results.

Existing "aggregated search" websites solve this partially, but they have fundamental problems:

1. Your search queries pass through their servers (privacy black box)
2. Data sources are hardcoded (you can't choose what to search)
3. Compliance risk is concentrated on the website (if it shuts down, your search capability disappears)
4. Ads and paywalls (their business model depends on selling search results)

What if you could run search aggregation **locally**, with full control over data sources, without your queries ever leaving your machine?

## Introducing SeekAll SDK

[SeekAll](https://seekall.winmelon.cn) is an open-source (AGPL-3.0) search rule engine SDK published on npm as `@seekall/sdk`. Instead of being a search website, it's a **library you import into your code**.

The core idea: each data source is a "rule" (also an npm package). The SDK queries all rules concurrently, deduplicates results, and returns a unified `Hit[]` array.

```typescript
import { createEngine } from "@seekall/sdk";
import arxiv from "@seekall/rule-arxiv";
import crossref from "@seekall/rule-crossref";
import github from "@seekall/rule-github";

const engine = createEngine({ rules: [arxiv, crossref, github] });
const hits = await engine.search("transformer attention mechanism");

hits.forEach((h) => {
  console.log(`[${h.source}] ${h.title}`);
  console.log(`  ${h.url}`);
});
```

That's it. One search call, results from arXiv + Crossref + GitHub — all deduplicated, all fetched from your machine.

## How Rules Work

A rule is just an object implementing the `Rule` interface:

```typescript
import type { Rule, Hit, RuleContext } from "@seekall/sdk";

export const myRule: Rule = {
  name: "@my-org/rule-example",
  version: "0.1.0",
  riskLevel: "L1",

  async search(keyword: string, ctx: RuleContext): Promise<Hit[]> {
    const response = await ctx.fetch(
      `https://api.example.com/search?q=${encodeURIComponent(keyword)}`,
    );
    const data = await response.json();
    return data.results.map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.description,
      meta: { score: item.relevance },
    }));
  },
};
```

Key points:

- Use `ctx.fetch` (not raw `fetch`) — the SDK handles concurrency, timeouts, and caching based on your license tier
- `riskLevel` marks the compliance tier (L0 academic, L1 open source, L2 community-reviewed)
- Return standard `Hit[]` format — results merge automatically with other rules

Publish to npm, submit to the [SeekAll rule marketplace](https://seekall.winmelon.cn/rules), and others can `npm i @my-org/rule-example`.

## Available Rules (17 packages on npm)

| Category      | Packages                                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Academic      | `@seekall/rule-arxiv`, `rule-crossref`, `rule-pubmed`, `rule-arxiv-trending`, `rule-openalex`, `rule-semantic-scholar` |
| Open Source   | `@seekall/rule-github`, `rule-hackernews`, `rule-github-trending`, `rule-hackernews-trending`                          |
| Community     | `@seekall/rule-reddit`, `rule-producthunt`                                                                             |
| Entertainment | `@seekall/rule-tmdb`, `rule-omdb`, `rule-lastfm`, `rule-igdb`                                                          |

All published on [npmjs.com](https://www.npmjs.com/org/seekall), installable with `npm i`.

## 5-Level Risk Rating

Not all data sources are equal. arXiv is academically pure; some sources are legally grey. SeekAll uses a 5-level risk rating:

| Level | Description                        | Visibility          |
| ----- | ---------------------------------- | ------------------- |
| L0    | Academic (arXiv, Crossref, PubMed) | Public, free        |
| L1    | Open source (GitHub, HN)           | Public, free        |
| L2    | Community-reviewed                 | Public after review |
| L3    | High risk                          | Admin only          |
| L4    | Extreme risk                       | Never public        |

The SDK defaults to L0 academic rules. Want more? Install additional rule packages. The tool is neutral — compliance responsibility is on the user.

## Performance Tiers

Free tier gives you 3 concurrent requests + 10s timeout. Paid tiers unlock more:

| Tier     | Concurrency | Timeout | Cache | Price         |
| -------- | ----------- | ------- | ----- | ------------- |
| free     | 3           | 10s     | none  | Free          |
| trial    | 5           | 8s      | none  | $0.15/7d      |
| monthly  | 10          | 5s      | 5min  | $2.50/30d     |
| lifetime | 20          | 3s      | 5min  | $9.50/forever |

For personal use and light research, the free tier is sufficient.

## CLI Mode

Don't want to write code? SeekAll has a CLI:

```bash
npx @seekall/sdk search "large language model"
npx @seekall/sdk rules list
npx @seekall/sdk rules install @seekall/rule-github
npx @seekall/sdk whoami
```

## How It Compares

|               | Elasticsearch     | Algolia         | SeekAll                     |
| ------------- | ----------------- | --------------- | --------------------------- |
| Deployment    | ES cluster needed | SaaS            | None (runs locally)         |
| Data sources  | You ingest        | You ingest      | Rules auto-fetch            |
| Query privacy | Via ES            | Via Algolia     | Local only                  |
| Cost          | Server costs      | $1/1000 queries | Free (base tier)            |
| Use case      | Site search       | Site search     | External search aggregation |

SeekAll doesn't replace ES or Algolia — it solves a different problem. ES/Algolia search your own data. SeekAll searches external sources.

## Getting Started

```bash
npm i @seekall/sdk @seekall/rule-arxiv @seekall/rule-github
```

```typescript
import { createEngine } from "@seekall/sdk";
import arxiv from "@seekall/rule-arxiv";
import github from "@seekall/rule-github";

const engine = createEngine({ rules: [arxiv, github] });
const hits = await engine.search("RAG retrieval augmented generation");
console.log(`Found ${hits.length} results`);
```

## Links

- **npm**: [@seekall/sdk](https://www.npmjs.com/package/@seekall/sdk)
- **GitHub**: [donggua12339/seekall](https://github.com/donggua12339/seekall)
- **Docs**: [seekall.winmelon.cn](https://seekall.winmelon.cn)
- **Rule marketplace**: [seekall.winmelon.cn/rules](https://seekall.winmelon.cn/rules)

## Conclusion

If you're building tools that need to search across multiple external sources — academic databases, code repositories, community forums — SeekAll gives you a clean, composable, privacy-preserving way to do it. Rules are npm packages, search runs locally, and the compliance model is built into the architecture.

100 lines of code to build your own search aggregator. Open source. No server needed.

---

_Tags: typescript, opensource, sdk, search, nodejs, npm, webdev, programming_
