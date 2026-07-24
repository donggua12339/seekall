# WM 发卡网 -> SeekAll Webhook 实现规格

> 给 WM 发卡网工程师的实现说明。SeekAll 端 endpoint 已就位,本文档只描述 WM 端需要做什么。

## 背景

SeekAll v0.5 通过 WM 发卡网卖会员卡(trial ¥1 / monthly ¥18 / lifetime ¥68)。用户在 WM 付款成功后,WM 需要主动 POST 一个 webhook 到 SeekAll,SeekAll 验证签名后生成 License code 入库,用户再用 License code 在 SDK 里激活。

## 触发点

监听现有的 `ORDER_PAID_EVENT`(已在 `apps/api/src/modules/order/events/order-paid.event.ts` 定义)。

参考 `apps/api/src/modules/notification/notification-trigger.service.ts:39` 的 `@OnEvent(ORDER_PAID_EVENT)` 写法,新增一个 `SeekallWebhookService` 监听同一事件。

## 目标 URL

```
POST https://seekall.winmelon.cn/api/v1/license/wm-webhook
```

## Request Body

```json
{
  "wmOrderId": "WM订单号(orderNo)",
  "tier": "trial | monthly | lifetime",
  "amount": 18,
  "signature": "HMAC-SHA256 hex 字符串"
}
```

字段说明:

- `wmOrderId`: WM 订单号(用 `OrderPaidPayload.orderNo`,不是 UUID id)
- `tier`: 从商品的 `seekallTier` 字段推断(见下方 tier 映射)
- `amount`: 订单实付金额(数字,单位元,如 18 / 1 / 68)
- `signature`: HMAC-SHA256 签名(见下方签名算法)

## 签名算法

```
signature = HMAC-SHA256(WM_WEBHOOK_SECRET, "${wmOrderId}|${tier}|${amount}").digest('hex')
```

注意:

- 拼接字符串用 `|` 分隔,顺序必须是 `wmOrderId|tier|amount`
- `amount` 必须是**字符串形式**参与签名(如 `"18"` 而不是 `"18.00"`)
- SeekAll 端用 `timingSafeEqual` 防侧信道,WM 端用标准 `crypto.createHmac('sha256', secret).update(msg).digest('hex')` 即可

参考 SeekAll 端验证代码: `apps/api/src/modules/license/license.service.ts:245`(SeekAll 仓库)。

## tier 映射方案(推荐方案 A)

### 方案 A:Product 表加 `seekallTier` 字段(推荐)

**Schema 改动**(`apps/api/prisma/schema.prisma` Product 模型):

```prisma
model Product {
  // ... 现有字段
  seekallTier  SeekallTier?  // nullable,仅 SeekAll 卡密商品需填
  // ...
}

enum SeekallTier {
  TRIAL
  MONTHLY
  LIFETIME
}
```

**商品编辑 UI**: 商户创建 SeekAll 卡密商品时,从下拉框选 tier(非 SeekAll 商品留空)。

**Webhook 触发逻辑**: 监听 `ORDER_PAID_EVENT`,查订单的 OrderItem -> Product,如果 `product.seekallTier` 非空,就触发 webhook。

**优点**: 干净,商户主动选,不会误触发。**缺点**: 需要 schema migration + UI 改动。

### 方案 C:SKU 命名规则(备选,零 schema 改动)

约定 SeekAll 卡密商品的 `name` 或某个字段含 `SEEKALL-TRIAL` / `SEEKALL-MONTHLY` / `SEEKALL-LIFETIME` 标记,webhook 监听器正则匹配。

**缺点**: 依赖人工遵守命名规则,易出错。仅在前端 UI 改动成本不可接受时用。

## 环境变量(WM 端)

在 `/opt/wm-card/.env`(或 docker compose env_file)加:

```
SEEKALL_WEBHOOK_URL=https://seekall.winmelon.cn/api/v1/license/wm-webhook
WM_WEBHOOK_SECRET=<从安全渠道获取,与 SeekAll 端一致>
```

`WM_WEBHOOK_SECRET` 是两端共享的对称密钥,**不入库不入 git**。向 SeekAll 项目负责人索取(见 `project_seekall.md` memory 的"关键配置"章节)。

## 错误处理

1. **webhook 调用失败不阻塞订单**: 用 `try/catch` 包住,失败只记日志(`logger.warn`),不抛异常,不影响订单状态
2. **超时**: HTTP 请求设 5 秒超时,超时视为失败
3. **重试**: 可选,失败时入 BullMQ 队列延迟重试(3 次: 1m / 5m / 30m);MVP 阶段可不重试,SeekAll 端有幂等检查,补单时 admin 可手动生成 License
4. **幂等**: SeekAll 端已做(同 `wmOrderId` 重复调用返回已存在的 License),WM 端无需额外处理

## 测试方法

1. **本地单元测试**: mock HTTP 请求,验证签名算法 + tier 映射逻辑
2. **本地 e2e**: 启动 WM + mock SeekAll endpoint(用 `httpbin.org` 或本地 mock server),创建 SeekAll 商品 -> 下单 -> 模拟付款,验证 webhook 触发
3. **生产实测**: WM 后台创建一个 ¥1 trial 商品,自己买一笔,看 SeekAll 端是否收到 webhook + 生成 License
   - SeekAll 端日志: `docker logs seekall-api --tail 50 | grep "WM webhook"`
   - SeekAll admin 后台: License 列表应出现新记录,note 含 `wm-order:<orderNo>`

## 完成验收清单

- [ ] Product schema 加 `seekallTier` 字段 + migration SQL
- [ ] 商品编辑 UI 加 tier 下拉(可选,商户端)
- [ ] `SeekallWebhookService` 监听 `ORDER_PAID_EVENT`
- [ ] HMAC-SHA256 签名实现(用 `crypto.createHmac`)
- [ ] HTTP POST 到 `SEEKALL_WEBHOOK_URL`,5 秒超时
- [ ] 错误处理: 失败不阻塞订单,只记日志
- [ ] 环境变量 `SEEKALL_WEBHOOK_URL` + `WM_WEBHOOK_SECRET` 配置
- [ ] 本地 e2e 测试通过
- [ ] 生产实测一笔 ¥1 trial,SeekAll admin 看到 License 生成

## 参考代码位置(SeekAll 仓库)

- Webhook endpoint: `apps/api/src/modules/license/license.controller.ts:58`(`@Post('wm-webhook')`)
- 签名验证 + License 生成: `apps/api/src/modules/license/license.service.ts:232`(`handleWmWebhook`)
- DTO 字段约束: `apps/api/src/modules/license/license.controller.ts:12`(`WmWebhookDto`)

## 联系

SeekAll 项目负责人: 冬瓜。索取 `WM_WEBHOOK_SECRET` 或报告 SeekAll 端问题。联系邮箱: 1660069758@qq.com
