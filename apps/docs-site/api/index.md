# API 文档

SeekAll API 完整文档,基于 OpenAPI 3.0 规范,由 [Redoc](https://redocly.com/redoc) 渲染。

<ClientOnly>
<iframe
  src="https://redocly.github.io/redoc/?url=https://seekall.winmelon.cn/api/v1/docs-json"
  style="width: 100%; height: 80vh; border: 1px solid #e2e8f0; border-radius: 8px;"
  loading="lazy"
></iframe>
</ClientOnly>

## 快速开始

### 基础 URL

```
https://seekall.winmelon.cn/api/v1
```

### 认证

所有需认证的端点使用 Bearer JWT:

```
Authorization: Bearer <accessToken>
```

- `accessToken`: 15 分钟过期,通过 `POST /auth/login` 获取
- `refreshToken`: 7 天过期,通过 `POST /auth/refresh` 刷新

### 响应格式

所有 API 返回统一格式:

```json
{
  "code": 0,
  "data": { ... },
  "message": "ok"
}
```

- `code: 0` 表示成功
- `code: 非 0` 表示业务错误(见错误码表)
- `data` 为响应数据,失败时为 `null`

### 主要端点分类

| 分类 | 端点前缀 | 认证 | 说明 |
|---|---|---|---|
| 认证 | `/auth/*` | 公开 | 注册/登录/刷新/密码重置 |
| 用户 | `/user/*` | Bearer JWT | 个人资料/交易/收据/退款/云同步 |
| 规则 | `/rules/*` | 部分公开 | 市场列表/订阅/提交/评审 |
| License | `/license/*` | 部分公开 | 兑换/邀请码/WM webhook |
| DMCA | `/dmca/*` | 公开 | 举报/透明度报告 |
| Admin | `/admin/*` | Bearer JWT + super_admin | 后台管理 |
| Health | `/health` | 公开 | 健康检查 |

## 离线访问

OpenAPI JSON 可直接下载: [openapi.json](https://seekall.winmelon.cn/api/v1/docs-json)

可导入到 Postman / Insomnia / Swagger Editor 等工具使用。

## SDK 配合

API 文档配合 SDK 使用效果更佳:

```bash
npm i @seekall/sdk
npx @seekall/sdk init my-app
```

详见 [SDK 文档](/sdk/)。
