# 做学术研究同时在 arxiv、crossref、pubmed 搜太累了，怎么办？

> 知乎回答体，目标搜索词：学术论文搜索、arxiv 搜索、多数据库搜索、学术搜索工具、crossref pubmed 同时搜

## 痛点

做 NLP / CV / 生物医学方向的研究，搜一个关键词要在 arxiv 看预印本、crossref 查 DOI 元数据、pubmed 看生物医学文献。同一个词复制粘贴 3 遍，结果散落在 3 个标签页，还要人肉去重。

更痛苦的是：有些方向还要搜 GitHub 看有没有开源实现、Hacker News 看有没有讨论。5 个网站来回切，效率极低。

## 解决方案：用 SeekAll SDK 一次搜全部

SeekAll 是一个开源的搜索规则引擎 SDK（npm 包 `@seekall/sdk`），核心思路很简单：**把多个数据源封装成"规则"，SDK 并发查询所有规则，结果汇总去重后返回。**

```typescript
import { createEngine } from "@seekall/sdk";
import arxiv from "@seekall/rule-arxiv";
import crossref from "@seekall/rule-crossref";
import pubmed from "@seekall/rule-pubmed";

const engine = createEngine({ rules: [arxiv, crossref, pubmed] });
const hits = await engine.search("large language model");

hits.forEach((h) => {
  console.log(`[${h.source}] ${h.title}`);
  console.log(`  ${h.url}`);
  console.log();
});
```

跑一下，arxiv + crossref + pubmed 的结果全部出来，自动去重。不用再 3 个标签页来回切了。

## 3 个内置学术规则

SeekAll 默认带 3 个 L0 学术规则（已发到 npm）：

| 规则包                   | 数据源             | 说明                               |
| ------------------------ | ------------------ | ---------------------------------- |
| `@seekall/rule-arxiv`    | arXiv API          | 预印本论文，支持标题/摘要/作者搜索 |
| `@seekall/rule-crossref` | Crossref API       | DOI 元数据，支持期刊/会议/书籍     |
| `@seekall/rule-pubmed`   | PubMed E-utilities | 生物医学文献，MeSH 术语搜索        |

全部调公开 API，不需要 API key，不需要登录。安装即用。

## 想加更多数据源？自己写规则

10 行代码就能写一个新规则。比如加一个 Semantic Scholar：

```typescript
import type { Rule, Hit, RuleContext } from "@seekall/sdk";

export const semanticScholar: Rule = {
  name: "@my-lab/rule-semantic-scholar",
  version: "0.1.0",
  riskLevel: "L0",
  async search(keyword: string, ctx: RuleContext): Promise<Hit[]> {
    const r = await ctx.fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(keyword)}&limit=10`,
    );
    const data = await r.json();
    return (data.data || []).map((p) => ({
      title: p.title,
      url: `https://www.semanticscholar.org/paper/${p.paperId}`,
      snippet: p.abstract?.slice(0, 200),
      meta: { citations: p.citationCount, year: p.year },
    }));
  },
};
```

写到 npm 发布后，其他人 `npm i @my-lab/rule-semantic-scholar` 就能用。

## 和 Google Scholar 的区别

Google Scholar 是搜索引擎，你没法控制它搜哪些库、不能自定义排序、不能程序化调用。SeekAll 是 SDK，你在代码里控制一切：搜哪些源、怎么排序、结果怎么处理。

而且 SeekAll 的搜索在你本机执行，搜索词不经过第三方服务器。做未发表的研究时，这一点很重要。

## 性能

免费档 3 并发 + 10s 超时，够轻度使用。学术场景推荐 ¥18 月卡（10 并发 + 5s 超时 + 5min 缓存），搜过的关键词 5 分钟内再搜直接返回缓存结果。

## 开始使用

```bash
npm i @seekall/sdk @seekall/rule-arxiv @seekall/rule-crossref @seekall/rule-pubmed
```

文档：https://seekall.winmelon.cn/sdk
GitHub：https://github.com/donggua12339/seekall

## 总结

做学术研究不想在 arxiv / crossref / pubmed 之间来回切？装个 `@seekall/sdk`，3 行代码一次搜全部。想加 Semantic Scholar / OpenAlex / DBLP？10 行代码写个规则包。搜索词不经过第三方，合规无风险。

---

_相关搜索：arxiv 搜索工具、crossref API、pubmed 批量搜索、学术论文聚合搜索、多数据库同时搜索、NLP 论文搜索_
