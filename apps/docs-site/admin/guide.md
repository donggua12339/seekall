# Admin 后台使用手册

::: warning ⚠️ 内部文档
本页面对搜索引擎 noindex,仅 super_admin 内部使用。
访问地址: `https://admin.seekall.winmelon.cn`(需 DNS 配置生效)
:::

## 1. 登录

1. 访问 `https://admin.seekall.winmelon.cn/login`
2. 输入 super_admin 用户名 + 密码
3. 非 super_admin 账号会被拒绝(即使凭证正确)
4. 登录后 JWT Access Token(15m)+ Refresh Token(7d)存 localStorage
5. 401 时自动刷新,7 天后需重新登录

## 2. 数据概览(Dashboard)

- **总用户数**: 所有注册用户(含未验证)
- **付费用户**: 当前 `isPaid=true` 用户数
- **License 总数**: 所有 license code(含已用/未用/已禁用)
- **DMCA 举报(上月)**: 上月收到 + 处理 + 拒绝数 + 平均响应小时

数据每次进入页面自动刷新。

## 3. DMCA 版权举报处理

### 3.1 列表

- 路径: `/dmca`
- 过滤: 全部 / 待处理 / 已验证 / 已下架 / 已拒绝
- 字段: ID / 原作品 / 版权方 / 侵权 URL / 状态 / 举报人 / 提交时间

### 3.2 详情页

点击列表"查看详情"进入 `/dmca/:id`,显示:
- 举报信息: 侵权 URL / 关联规则 / 原作品 / 版权方 / 举报人邮箱 + 身份 / 电子签名 / 提交时间
- 法定声明状态: 善意声明 ✓/✗ + 准确性声明 ✓/✗(必须都 ✓ 才接受)
- 处理记录(已处理后显示): 处理人 / 处理时间 / 处理备注

### 3.3 处理操作

| 动作 | 含义 | 何时用 |
|---|---|---|
| **verify** | 核实后标记为已验证(准备下架) | 已确认侵权事实,准备下架 |
| **action** | 执行下架(触发 Rule.takedown) | 关联规则已确认,执行下架 |
| **reject** | 拒绝(误报,必须填理由) | 经核实不构成侵权 / 缺证据 |

### 3.4 处理流程

```
公众 webform 提交
    ↓
dmca_notices 入库(status=pending)
    ↓
admin 邮件通知(配置 DMCA_ADMIN_EMAIL)
    ↓
admin 复核(24h 内首次响应,工作日 4h)
    ↓
verify(已验证)→ action(下架,触发 Rule.takedown)
                ↘
                  reject(误报,填理由)
    ↓
透明度报告每月 1 号统计上月数据
```

### 3.5 合规要求

- **响应时间**: 24h 内人工响应(工作日 4h 内首次回复)
- **误报申诉**: 邮件主题前缀 `[COUNTER-NOTICE]`,7 个工作日内复审
- **记录保留**: takedown 记录永不删除(R4 合规要求)
- **作者封禁**: 累计 3 次 takedown 自动封禁作者 + 下架所有规则

## 4. 规则评审

### 4.1 列表

- 路径: `/rules`
- 过滤: L0-L4 风险等级
- 字段: ID / npm 包名 / 描述 / 风险 / 状态 / 下架次数 / 提交时间

### 4.2 风险评级

| 级别 | 含义 | 谁能看 | 谁能订阅 |
|---|---|---|---|
| **L0** | 公开学术(arxiv/crossref/pubmed) | 所有人 | 免费 |
| **L1** | 通用开源(GitHub API 等) | 所有人 | 免费 |
| **L2** | 社区评审(需付费会员评审) | 所有人 | 付费 |
| **L3** | 高风险(admin 创建,仅 admin 可见) | 仅 admin | 永不 |
| **L4** | 极高风险(admin 创建,仅 admin 可见) | 仅 admin | 永不 |

### 4.3 评审工作流(L2)

```
作者提交 L2 规则
    ↓
status=pending_review(进入评审池)
    ↓
付费会员评审(一人一票,可改票)
    ↓
≥3 赞成 → admin 终审
    ↓
approve → status=published
reject → status=banned
```

### 4.4 Admin 终审操作

- **通过**: status -> published(规则上架)
- **拒绝**: status -> banned(规则封禁)
- **下架**(已发布规则): 触发 Rule.takedown,累计 3 次封禁作者

### 4.5 Takedown 操作

点击"下架"按钮 -> 填写下架理由(如"DMCA #123")-> 确认:
1. Rule.status -> taken_down
2. Rule.takedownCount + 1
3. AdminAuditLog 记录
4. 若作者累计 3 次 takedown:
   - User.status -> banned
   - bannedReason = "累计 3 次规则 takedown"
   - 作者所有 published 规则 -> taken_down

## 5. License 管理

### 5.1 列表

- 路径: `/licenses`
- 过滤: 状态(未用/已用/已禁用)+ 档位(试用/月卡/永久)
- 字段: ID / Code / 档位 / 状态 / 备注 / 创建时间

### 5.2 生成 License

点击"生成 License"按钮:
1. 选档位: trial(7天)/ monthly(30天)/ lifetime(100年)
2. 选数量: 1-100
3. 填备注: 如 "WM 订单号" / "邀请码活动"
4. 生成后弹窗显示所有 code,可复制分发

### 5.3 禁用 License

- 仅 unused 状态可禁用
- 禁用后不可恢复
- 已 used 的 license 不能禁用(已生效)

### 5.4 License Code 格式

```
SA-TRY-XXXXXXXXXXXXXXXX  (trial,16 位 hex 大写)
SA-MON-XXXXXXXXXXXXXXXX  (monthly,16 位 hex 大写)
SA-LIF-XXXXXXXXXXXXXXXX  (lifetime,16 位 hex 大写)
```

## 6. 用户管理

### 6.1 列表

- 路径: `/users`
- 搜索: 用户名 / 邮箱
- 字段: ID / 用户名 / 邮箱 / 角色 / 会员 / 状态 / 注册时间 / 操作

### 6.2 封禁用户

- 仅非 super_admin 可封禁
- 必须填写封禁理由
- 封禁后 User.status -> banned
- 已封禁用户可解封

### 6.3 状态说明

| 状态 | 含义 |
|---|---|
| pending_verification | 注册未验证邮箱 |
| active | 正常 |
| banned | 已封禁 |
| deleted | 已删除(软删除) |

## 7. 审计日志

- 路径: `/audit-logs`
- 字段: ID / 操作人 / 动作 / 目标类型 / 目标 ID / 详情 / 时间
- 所有 admin 操作自动记录:
  - `rule_final_review` / `rule_takedown` / `rule_admin_create`
  - `user_ban` / `user_unban`
  - `license_generate` / `license_disable`
  - `dmca_handle`

## 8. 透明度报告

- API: `GET /api/v1/dmca/transparency`(公开)
- 每月 1 号统计上月:
  - 收到举报数
  - 已执行下架数(actioned)
  - 拒绝数(rejected,误报)
  - 待处理数(pending)
  - 平均响应时间(小时)

## 9. 常见问题

### Q: 登录后 7 天又被踢出?

A: JWT Refresh Token 7 天过期,正常现象,重新登录即可。

### Q: DMCA 处理后能撤销吗?

A: 不能。takedown 记录永不删除(R4 合规要求)。如误处理,可手动恢复 Rule.status=published(需 SQL 操作,谨慎)。

### Q: License Code 生成后能改档位吗?

A: 不能。Code 已绑定 tier,如需改档位请禁用后重新生成。

### Q: 作者被自动封禁后能解封吗?

A: 可以。admin 在用户管理页手动 unban。但作者的规则状态不会自动恢复,需逐条重新发布。

### Q: 如何查看前端 Sentry 错误?

A: 当前 admin 前端未接 Sentry(M3 待办)。API 已接 Sentry,在 sentry.io 查看 SeekAll 项目。

## 10. 安全注意事项

- **不要在浏览器存 super_admin 密码**
- **不要把 admin URL 发到任何公开渠道**(主站不挂链接)
- **JWT Token 泄露后**: 立即登录 -> 退出所有设备(后端 `/auth/sessions` API)
- **定期更换密码**: 建议 90 天一次
- **DMCA 处理备注不要写敏感信息**: 可能出现在透明度报告中
