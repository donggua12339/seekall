# 示例规则

SeekAll 内置 3 个 L0 学术示例规则：

## @seekall/rule-arxiv

搜索 arxiv.org 学术论文。风险级别：L0 学术纯净。数据源：arxiv.org 公开 API。

## @seekall/rule-crossref

搜索 crossref.org 学术文献元数据。风险级别：L0 学术纯净。数据源：crossref.org 公开 API。

## @seekall/rule-pubmed

搜索 pubmed 生物医学文献。风险级别：L0 学术纯净。数据源：pubmed.ncbi.nlm.nih.gov 公开 API。

## 组合使用

```ts
import { createEngine } from '@seekall/sdk'
import arxiv from '@seekall/rule-arxiv'
import crossref from '@seekall/rule-crossref'
import pubmed from '@seekall/rule-pubmed'

const engine = createEngine({ rules: [arxiv, crossref, pubmed] })
const hits = await engine.search('covid vaccine mrna')
```

## 自己写规则

参考 [Rule 接口](rule-interface) 从 0 实现。
