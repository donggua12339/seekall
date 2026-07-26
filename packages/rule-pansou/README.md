# @seekall/rule-pansou

网盘资源搜索规则（无头浏览器渲染 CSR 网盘搜索站）。

## 为什么需要无头浏览器

夸克搜索、UP云搜、阿里云盘搜等网盘搜索站的搜索结果是 **JS 动态渲染**的（CSR），
普通 `fetch + cheerio` 只能拿到空壳 HTML。本规则用 `puppeteer-core` 启动无头浏览器，
渲染页面后再提取结果。

## 数据源

| 源 | 地址 | 状态 |
|----|------|------|
| 阿里云盘搜 | alipansou.com | ✅ 稳定命中 |
| 夸克搜索 | search.quark.cn | ⚠️ DOM 待调 |
| UP云搜 | upyunso.com | ⚠️ DOM 待调 |

## 特性

- 每次搜索临时 launch 浏览器、结束即 close（避免常驻吃内存）
- 单次搜索内**串行**访问各源（避免多 page 并发 OOM，适配 4GB 服务器）
- 响应 `ctx.signal` 取消
- 结果统一打 `meta.category: 'pan'`

## 依赖

运行环境需安装 Chrome/Chromium/Edge，路径通过 `PUPPETEER_EXECUTABLE_PATH` 指定，
默认自动探测常见位置。Docker 内（alpine）由 API Dockerfile `apk add chromium` 提供。

## 开发

```bash
pnpm install
pnpm build
# 本地用 Edge 测试
node test-smoke.mjs "Photoshop"
```

## License

MIT
