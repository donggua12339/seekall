---
title: 贡献者排行榜
description: SeekAll 规则市场贡献者排行榜，按已发布规则数排序。社区共建中立搜索工具。
---

# 贡献者排行榜

SeekAll 是中立的搜索规则引擎 SDK + 规则市场。规则由社区贡献，按 5 级风险评级（L0-L4）分类。这里展示为社区贡献已发布规则的开发者。

排名按**已发布（published）规则数**排序，takedown / banned 的规则不计入。

---

<ClientOnly>
  <ContributorsLeaderboard />
</ClientOnly>

---

## 如何加入排行榜

1. 注册 SeekAll 账号
2. 写一个规则包（npm 包，实现 `Rule` 接口，10 行代码就够）
3. `npm publish --access public` 发到 npm
4. 在规则市场点"提交规则"，填写 npm 包名 + 风险评级 + 描述
5. L0/L1 自动上架，L2 进入社群评审（≥3 赞成 -> admin 终审）
6. 规则 published 后，你自动进入排行榜

详见 [作者指南](../rules/author-guide) 和 [SDK 文档](../sdk/)。

## 贡献者徽章

- 🟢 **贡献者**（contributor）：至少 1 个规则 published
- 🟡 **评审员**（reviewer）：参与 L2 规则评审（需月度会员）
- 🔵 **早期用户**（early_adopter）：v0.5.x 阶段注册的早期用户

徽章由 admin 手动标注，不是自动发放。如果你符合条件但没徽章，可以发邮件到 1660069758@qq.com 申请。

## 贡献者权益

- 早期贡献者（规则 published >= 1）可申请 **终身会员** 兑换码（限量，先到先得）
- 评审员享受月度会员免费续期（需持续参与评审）
- 排行榜 Top 10 在文档站首页展示

详见 [贡献者邀请计划](./contributor-invite)。
