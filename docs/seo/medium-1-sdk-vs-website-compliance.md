# Why I Built a Search SDK Instead of a Search Website — A Compliance-First Design

> Medium / dev.to 英文反思体，目标搜索词：search engine compliance, DMCA safe harbor, search aggregation legal, tool neutrality, open source search design philosophy

## The Compliance Trap

If you search for "aggregated search engine" or "multi-source search tool," you'll find dozens of websites that promise to search everything in one place. Most of them are legally vulnerable.

Here's why: when a website acts as an intermediary — receiving user queries, fetching results from external sources, and displaying them — it assumes **content liability**. This means:

- **DMCA takedown notices** target the website, not the original source
- **Platform ToS violations** (many APIs prohibit automated scraping at scale) become the website's problem
- **Data scraping legal risk** (varies by jurisdiction — hiQ v. LinkedIn in the US, anti-unfair competition law in China) concentrates on the website operator
- **Content moderation responsibility** falls on whoever displays the results

These aren't theoretical risks. Search aggregation websites get DMCA'd, blocked, and shut down regularly. The fundamental issue is that **the website, as intermediary, bears the content responsibility**.

## The Reverse Decision: No Website, Only an SDK

I chose the opposite approach. Instead of building a search website, I built **SeekAll** — a search rule engine SDK published as an npm package (`@seekall/sdk`).

The key architectural decision: **the server never participates in search**.

Here's what the SeekAll server does:

- Account management
- Rule marketplace listing (metadata only)
- DMCA email receipt

Here's what it does **not** do:

- Receive user search queries
- Fetch data from external sources
- Return search results
- Store any search-related data

The search happens entirely on the user's machine:

```
User's machine → npm i @seekall/sdk + rules
              → engine.search('keyword')
              → rules fetch from data sources (arXiv, GitHub, etc.)
              → results returned to user's machine
```

The SeekAll server never sees the query, never sees the results, never contacts any data source. This isn't a privacy feature bolted on — it's the core architecture.

## Tool Neutrality: The BitTorrent Analogy

BitTorrent the protocol is neutral (it can distribute Linux ISOs or copyrighted content). But BitTorrent index sites bear liability because they index and locate specific content.

SeekAll makes the same distinction:

- **The SDK is like the BitTorrent protocol** — neutral tool, runs on user's machine
- **The rule marketplace is like a package registry** — indexes tools (npm packages), not content
- **No resource indexing** — SeekAll never indexes what any rule can find; it only indexes the rules themselves

The critical boundary: **SeekAll knows which rules exist, but not what any rule can find.** What a rule returns is only known when the user runs it locally.

This is fundamentally different from a search website, which knows exactly what results it's showing (because it fetched them).

## 5-Level Risk Rating

Tool neutrality alone isn't enough. Data sources have different risk profiles. arXiv is academically pure; some sources are legally grey areas. If SeekAll shipped all rules by default, it would effectively guide users toward high-risk sources.

So I designed a **5-level risk rating system**:

| Level | Description        | Visibility          | Example                 |
| ----- | ------------------ | ------------------- | ----------------------- |
| L0    | Academic pure      | Public, free        | arXiv, Crossref, PubMed |
| L1    | Open source        | Public, free        | GitHub, Hacker News     |
| L2    | Community reviewed | Public after review | Community APIs          |
| L3    | High risk          | Admin only          | Grey-area sources       |
| L4    | Extreme risk       | Never public        | —                       |

Core rules:

1. L0-L2 rules are public; anyone can install them
2. L3-L4 rules are **never visible to non-admins**, even paid users
3. Server code contains **zero HTTP clients** (`apps/api/src/modules/rule/` has no `axios`/`fetch`/`http`) — the server literally cannot contact any data source
4. No comments, ratings, or forums (avoids UGC liability)

## The Five Red Lines

These are non-negotiable architectural constraints:

1. **No default rules pointing to copyrighted or file-sharing sites**
2. **L3/L4 rules never visible to non-admins** (even if paid)
3. **No comments/ratings/forums** (UGC liability)
4. **No outbound HTTP from the rule module** (server can't contact data sources)
5. **No payment SDK integration** (use card codes + webhook instead)

These aren't policies that could change — they're enforced by the code architecture.

## The Trade-offs

This design has real costs:

**User experience**: Users need to `npm i` packages and write code. Not as convenient as a search box. SeekAll targets developers and researchers, not casual users.

**Cold start**: Default 0 rules (or L0 only) means new users need to install rules. But "default 0 rules" is a compliance requirement, not a bug.

**Business model ceiling**: Can't monetize through "resource access" (ads, paywalled results). Only through "performance differentiation" (free 3 concurrent vs paid 10 concurrent + cache). Lower ceiling.

**Technical barrier**: Rules require code (though 10 lines is enough). But this also filters out abuse.

These trade-offs are deliberate. The tool-neutral path is harder, but more sustainable.

## Practical Implementation

Despite the philosophy, SeekAll is practical to use:

```typescript
import { createEngine } from "@seekall/sdk";
import arxiv from "@seekall/rule-arxiv";
import github from "@seekall/rule-github";

// 3 lines to search across arXiv + GitHub
const engine = createEngine({ rules: [arxiv, github] });
const hits = await engine.search("transformer attention");
```

17 rule packages are already published on npm, covering academic databases, code repositories, community forums, and entertainment APIs. Writing a new rule takes 10 lines of TypeScript.

The CLI works too:

```bash
npx @seekall/sdk search "large language model"
```

## Conclusion

Most search aggregation tools fail because they put the website in the middle — making it the legal target for every DMCA notice, every ToS violation, every content moderation demand.

SeekAll removes the middleman by design. The SDK runs on your machine. Rules are npm packages. The server never sees your queries or results. Compliance isn't a policy — it's the architecture.

This isn't the most profitable approach. But it's the most sustainable one. Tool neutrality isn't avoiding responsibility — it's drawing a clear responsibility boundary. SeekAll provides the engine. You decide what to search. Each party bears their own compliance responsibility.

---

**Links:**

- npm: [@seekall/sdk](https://www.npmjs.com/package/@seekall/sdk)
- GitHub: [donggua12339/seekall](https://github.com/donggua12339/seekall) (AGPL-3.0)
- Docs: [seekall.winmelon.cn](https://seekall.winmelon.cn)
- Rule marketplace: [seekall.winmelon.cn/rules](https://seekall.winmelon.cn/rules)

---

_Tags: compliance, open-source, search-engine, architecture, typescript, dmca, tool-neutrality, sdk, design-philosophy, programming_
