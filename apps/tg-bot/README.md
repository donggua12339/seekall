# 觅源 SeekAll - Telegram Bot

> 独立服务，通过 SeekAll API 搜索资源

## 配置

1. 创建 TG Bot（@BotFather -> /newbot -> 获取 token）
2. 在 `.env` 中配置：
   ```
   TG_BOT_TOKEN=你的Bot Token
   SEEKALL_API_URL=http://localhost:7301
   SEEKALL_API_KEY=sk_xxx  # 可选，用于私有部署
   ```

## 运行

```bash
# 安装依赖
pnpm install

# 开发
pnpm dev

# 生产
pnpm build && pnpm start
```

## 功能

- `/start` - 欢迎信息
- `/search <关键词>` - 搜索资源
- 直接发送关键词 - 快速搜索
- `/help` - 帮助

## 合规说明

- Bot 仅返回链接聚合，不存储内容
- 遵循 Z++ 合规红线
- 需邀请码注册 SeekAll 账号获取 API Key
