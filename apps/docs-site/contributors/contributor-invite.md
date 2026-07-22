---
title: 贡献者邀请计划
description: SeekAll 贡献者邀请计划，提交规则换终身会员。早期贡献者激励。
---

# 贡献者邀请计划

SeekAll v0.6 阶段，为了激励社区贡献规则，推出**贡献者邀请计划**。

## 计划详情

### 1. 提交规则换终身会员

**条件**：在 SeekAll 规则市场成功 publish 至少 1 个 L0 或 L1 规则（学术开源类，如 arxiv / crossref / GitHub Trending / HackerNews 等）。

**奖励**：**终身会员（lifetime，¥68 价值）** 兑换码 1 个。

**限额**：v0.6 阶段限量 20 个，先到先得。

### 2. 评审员月度续期

**条件**：持有月度会员 + 在 30 天内参与至少 3 个 L2 规则的评审（approve / reject 都算）。

**奖励**：下一个月度会员免费续期（¥18 价值）。

**限额**：每月限量 10 个名额。

### 3. 早期用户徽章

**条件**：在 2026-09-30 前注册 SeekAll 账号 + 完成邮箱验证。

**奖励**：**早期用户徽章**（user-spa Dashboard 展示）+ 试用邀请码 3 个（可分享给朋友）。

## 如何参与

### 提交规则换终身会员

1. 注册 SeekAll 账号（[https://seekall.winmelon.cn](https://seekall.winmelon.cn)）
2. 写一个规则包：

```typescript
// my-rule.ts
import type { Rule, Hit, RuleContext } from '@seekall/sdk'

export const myRule: Rule = {
  name: '@your-name/rule-xxx',
  version: '0.1.0',
  riskLevel: 'L1', // L0 学术 / L1 开源

  async search(keyword: string, ctx: RuleContext): Promise<Hit[]> {
    // 你的实现：调公开 API，返回 Hit[]
  },
}
```

3. 发到 npm：
   ```bash
   npm publish --access public
   ```

4. 在 SeekAll 规则市场点"提交规则"，填写 npm 包名 + 风险评级 + 描述

5. L0/L1 自动 published 后，发邮件到 `1660069758@qq.com` 申请终身会员兑换码：
   - 主题：`[贡献者邀请] 规则名 - 用户名`
   - 正文：附 npm 包链接 + SeekAll 用户名 + 注册邮箱
   - 1-3 个工作日内人工审核 + 发兑换码

### 评审员月度续期

1. 持有月度或终身会员
2. 在 user-spa 规则市场页评审 L2 规则（≥3 票/30天）
3. 邮件申请续期：`[评审员续期] 用户名 - 评审的规则列表`

## 规则

### 红线（违反取消资格）

- ❌ 提交指向具体网盘 / 磁力 / 盗版站的规则
- ❌ 提交 L3/L4 风险评级规则（仅 admin 可创建）
- ❌ 抄袭他人规则
- ❌ 评审自己提交的规则
- ❌ 用多个账号刷邀请码

### 合规要求

- 规则只能调公开 API（不需登录）
- 规则代码不能包含绕反爬逻辑
- 规则不能索引盗版 / 版权内容
- 详见 [5 条不可逾越的红线](../guide/what-is-seekall)

## FAQ

**Q: 我不会写 TypeScript，能参与吗？**
A: 可以。规则接口很简单（10 行代码），参考 [100 行代码构建搜索聚合工具](../blog/tutorial-100-lines)。如果规则有价值（如某个垂直领域的公开 API），可以发邮件，我们帮写。

**Q: L2 规则算贡献吗？**
A: L2 规则需要社群评审，通过后算。但 L2 评审员有额外激励（月度续期）。

**Q: 终身会员兑换码能转让吗？**
A: 不能。兑换码绑定你的账号，但你可以把试用邀请码（3 个）分享给朋友。

**Q: 名额满了怎么办？**
A: v0.6 阶段限量 20 个，v0.7 会开放更多。关注 [GitHub](https://github.com/donggua12339/seekall) 获取更新。

## 联系

- 邮箱：1660069758@qq.com
- GitHub Issues：[donggua12339/seekall](https://github.com/donggua12339/seekall/issues)
- 微信群：暂未建，v0.6 阶段用邮件 + GitHub Issues
