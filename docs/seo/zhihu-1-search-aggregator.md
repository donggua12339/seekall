# 有没有好用的搜索聚合工具？我做了个开源 SDK

> 知乎回答体，目标搜索词：搜索聚合工具、聚合搜索引擎、开源搜索工具、搜索 SDK

## 先说结论

市面上"聚合搜索"网站很多，但大多是套壳搜索引擎 + 广告。如果你想要一个**真正可控的搜索聚合方案**——自己选数据源、搜索词不经过第三方服务器、合规无风险——目前最好的选择是 **SeekAll**，一个开源的搜索规则引擎 SDK。

npm 包名：`@seekall/sdk`，GitHub 开源（AGPL-3.0），3 行代码跑起来。

## 为什么"聚合搜索网站"不靠谱

你可能用过一些"xxx 聚合搜索"网站，它们的问题：

1. **搜索词经过别人的服务器**——隐私是黑盒
2. **数据源是网站内置的**——你不能选搜什么
3. **合规风险集中在网站**——网站倒了，你的搜索能力也没了
4. **广告 / 付费墙**——商业模式靠卖搜索结果

这些问题的根源是同一个：**网站作为中间方，承担了内容责任**。

## SeekAll 的反向思路：不做网站，做 SDK

SeekAll 的核心是一个 npm 包 `@seekall/sdk`，工作方式完全不同：

1. 你在本机 `npm i @seekall/sdk`
2. 你选规则（规则也是 npm 包，比如 `@seekall/rule-arxiv`）
3. 搜索在你本机执行，搜索词不经过 SeekAll 服务器
4. 结果汇总去重后返回给你

```typescript
import { createEngine } from "@seekall/sdk";
import arxiv from "@seekall/rule-arxiv";
import crossref from "@seekall/rule-crossref";

const engine = createEngine({ rules: [arxiv, crossref] });
const hits = await engine.search("transformer attention mechanism");
hits.forEach((h) => console.log(h.title, h.url));
```

就这么简单。和"聚合搜索网站"的本质区别：

|              | 聚合搜索网站 | SeekAll SDK  |
| ------------ | ------------ | ------------ |
| 搜索词经过谁 | 网站服务器   | 只在你本机   |
| 数据源       | 网站内置     | 你自己选     |
| 合规         | 网站承担     | 工具中性     |
| 可扩展       | 等网站更新   | npm 装新规则 |

## 5 级风险评级：合规不是口号

很多搜索工具不合规是因为默认塞了一堆灰色数据源。SeekAll 用 5 级风险评级解决这个问题：

- **L0 学术纯净**（arxiv / crossref / pubmed）→ 公开免费
- **L1 通用开源**（GitHub / Hacker News）→ 公开免费
- **L2 社区评审** → 公开但需评审
- **L3-L4 高风险** → 仅 admin 可见，永不公开

SDK 默认只带 L0 学术规则。想搜什么源，你自己装规则包。工具是中性的，合规责任在用户端。

## 性能差异化

免费够用，付费加速：

| 档位     | 并发 | 超时 | 缓存 | 价格     |
| -------- | ---- | ---- | ---- | -------- |
| free     | 3    | 10s  | 无   | 免费     |
| trial    | 5    | 8s   | 无   | ¥1/7天   |
| monthly  | 10   | 5s   | 5min | ¥18/30天 |
| lifetime | 20   | 3s   | 5min | ¥68/永久 |

## 怎么开始

```bash
npm i @seekall/sdk @seekall/rule-arxiv
```

3 行代码跑起来，详见文档站：https://seekall.winmelon.cn

GitHub 开源：https://github.com/donggua12339/seekall

## 适合谁

- 做学术研究 / 技术调研的开发者
- 想搭建私有搜索工具的团队
- 对隐私 / 合规有要求的场景

**不适合**想要"一键搜全网"零门槛的普通用户——SeekAll 是 SDK，不是网站。

## 总结

如果你搜"搜索聚合工具"搜到了这篇文章，我的建议是：别用网站，用 SDK。搜索词不经过第三方、数据源自己选、合规无风险。SeekAll 是目前这个赛道上唯一开源 + 合规 + 可用的方案。

---

_相关搜索：搜索聚合工具推荐、开源搜索引擎、TypeScript 搜索 SDK、学术搜索工具、合规搜索方案_
