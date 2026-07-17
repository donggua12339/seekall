# 试用码机制

## ¥1 试用码的来源

| 来源 | 触发方式 | 频率 |
|---|---|---|
| W1 admin 手动生成 | admin 在卡密管理页生成 | 不限 |
| W2 WM webhook 半自动 | 用户在 WM 付款 -> WM POST SeekAll -> 自动入库 | 不限 |
| W3 老用户邀请码 | 付费用户在"我的账户"页生成 | 每月 3 个 |

## 防羊毛

- `License.trialClaimedAt` 字段记录试用领取时间
- 兑换试用码时检查：若 `trialClaimedAt != null`，拒绝
- 邀请码生成时检查：本月已生成数 < 3

## 邀请码生成 UI

```
我的账户 -> 生成试用码 -> [生成按钮]
                          ↓
              弹窗显示一次性 16 位 code
              （如：SA-TRY-A1B2C3D4E5F6G7H8）
              复制按钮 + "本月已用 1/3"
```

## code 格式

`SA-TRY-XXXXXXXXXXXXXXXX`（16 位随机大写字母数字）

生成算法：
```ts
const code = 'SA-TRY-' + crypto.randomBytes(8).toString('hex').toUpperCase()
```

## 邀请码月底重置

每月 1 号 00:00 重置老用户的 `monthlyInviteCount` 字段。
通过 cron job 触发 admin API。
