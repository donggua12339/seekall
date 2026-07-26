# WM 发卡网 Webhook 改造需求：增加 cardContent 字段

## 问题

用户在 WM 购买 ¥1 trial 后，WM 发给用户的卡密是 UUID 格式（如 `00b9091c-dbfd-46cb-92c1-59eee07d790e`）。但 SeekAll 的 webhook handler 收到回调后自己生成了 `SA-TRY-XXXXXXXX` 格式的 license code 存入数据库。

用户拿 WM 的 UUID 卡密去 SeekAll 激活 → 报 "License code 不存在"。

**根因**：WM 发给用户的卡密内容和 SeekAll 入库的 license code 是两套不同的标识符，没有映射关系。

## 修复

SeekAll 侧已改好（commit `55abf97`）：webhook handler 现在接受可选的 `cardContent` 字段。如果 WM 传了 `cardContent`，SeekAll 直接用它作为 license code 入库，用户拿到 WM 卡密就能直接 redeem。

## 需要 WM 侧改的

在 webhook 回调的 JSON body 里加一个字段 `cardContent`，值为**发给用户的卡密内容**（就是用户在订单详情里看到的"卡密"那个字符串）。

### 改前（当前 WM webhook payload）

```json
{
  "wmOrderId": "339855484397817856",
  "tier": "trial",
  "amount": 1,
  "signature": "abc123..."
}
```

### 改后

```json
{
  "wmOrderId": "339855484397817856",
  "tier": "trial",
  "amount": 1,
  "signature": "abc123...",
  "cardContent": "00b9091c-dbfd-46cb-92c1-59eee07d790e"
}
```

`cardContent` 的值 = WM 库存里那条卡密的"卡密内容"字段（发给用户的那个字符串）。

### 签名算法不变

签名仍然只算 `wmOrderId|tier|amount`，`cardContent` 不参与签名计算（向后兼容）。

### 代码改动位置

WM 发卡网的 webhook 发送逻辑里，在构造 payload 时，从订单关联的卡密记录中取出卡密内容，加到 JSON body 里：

```typescript
// 伪代码
const payload = {
  wmOrderId: order.id,
  tier: order.sku.tier,
  amount: order.amount,
  cardContent: order.card.content, // ← 新增这一行
};
payload.signature = hmacSHA256(
  WEBHOOK_SECRET,
  `${payload.wmOrderId}|${payload.tier}|${payload.amount}`,
);
```

### 向后兼容

- `cardContent` 是可选字段，旧版 WM 不传也不影响（SeekAll 会 fallback 到自己生成 SA-XXX-XXXX）
- 签名算法不变，不影响现有签名验证

## 当前已付款用户的临时修复

在 WM 改好之前，已付款用户的 UUID 卡密无法在 SeekAll 激活。临时方案：

1. SeekAll admin 在后台手动生成一个 trial license code
2. 通过客服/邮件把 code 发给用户
3. 或者直接在 SeekAll 数据库插入一条 License 记录，code 设为 WM 的 UUID

## 长期方案（可选）

如果不想改 WM webhook，也可以改运营流程：

1. SeekAll admin 批量生成 SA-TRY-XXXX codes
2. 把这些 codes 粘贴到 WM 后台作为卡密库存（替换 UUID）
3. 用户购买后 WM 发的就是 SA-TRY-XXXX，直接 redeem

这个方案不需要改 WM 代码，但需要 admin 手动操作。
