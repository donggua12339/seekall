# 小红书卡片 1: npm 包也能跑搜索？SeekAll SDK 试用

## 标题（3 选 1）

- A. npm 包也能跑搜索？我做了个规则引擎 SDK
- B. 终端一行命令搜遍全网，开发者的新玩具
- C. 不做搜索网站，只发 npm 包：我的反向决策

**推荐 A**（有钩子 + 疑问句 + 产品名）

## 正文（300 字内）

做学术研究 / 技术调研，经常要在 arxiv、crossref、GitHub 之间来回切，同一个关键词复制粘贴 3 遍 😩

我做了个 npm 包 @seekall/sdk，核心思路：
· "搜索" = 一个规则数组
· 你自己写规则（10 行代码）
· SDK 在你本机跑，结果汇总去重
· 完全客户端执行，服务端零接触

和"xxx 聚合搜索"网站不一样：
· 我不做网站服务，只发 npm 包
· 默认 0 规则（自己装，工具中性）
· 规则通过 npm 分发，社区贡献

3 行代码跑起来：

```
npm i @seekall/sdk @seekall/rule-arxiv
const engine = createEngine({ rules: [arxiv] })
const hits = await engine.search('transformer')
```

项目地址 github.com/donggua12339/seekall
AGPL 开源，欢迎 star ✨

#前端开发 #TypeScript #npm #开源项目 #技术分享 #开发者工具

## 配图建议（9:16 竖图，3-5 张）

1. **封面**：终端运行截图（SeekAll CLI 跑起来 + 搜索结果输出），加标题文字"npm 包也能跑搜索？"
2. **架构图**：用户机器 -> SDK -> npm 规则（简洁流程图，蓝色科技风）
3. **代码截图**：3 行代码跑起来的核心代码（语法高亮，深色主题）
4. **对比图**：聚合搜索网站 vs SeekAll（左：搜索词经过网站服务器；右：搜索词只在本机）
