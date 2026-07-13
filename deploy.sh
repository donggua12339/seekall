#!/usr/bin/env bash
# 觅源 SeekAll - 一键部署脚本
# 用法：./deploy.sh
# 前提：服务器已安装 Node.js 20+、MySQL 8、Redis、PM2、Caddy

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

echo "====== 觅源 SeekAll 部署脚本 ======"
echo "目录: $PROJECT_DIR"
echo ""

# 1. 检查 .env
if [ ! -f ".env" ]; then
  echo "❌ .env 文件不存在，请复制 .env.production 并填写实际值"
  echo "   cp .env.production .env"
  exit 1
fi

# 2. 拉取最新代码（如果是 git 仓库）
if [ -d ".git" ]; then
  echo "📥 拉取最新代码..."
  git pull --ff-only
fi

# 3. 安装依赖
echo "📦 安装依赖..."
pnpm install --frozen-lockfile

# 4. 生成 Prisma Client
echo "🔧 生成 Prisma Client..."
pnpm --filter api prisma:generate

# 5. 数据库迁移
echo "🗄️ 执行数据库迁移..."
pnpm --filter api prisma:migrate:deploy

# 6. 构建后端
echo "🔨 构建后端..."
pnpm --filter api build

# 7. 构建前端
echo "🔨 构建前端..."
pnpm --filter web build

# 8. 创建日志目录
echo "📝 创建日志目录..."
sudo mkdir -p /var/log/seekall
sudo chown "$USER":"$USER" /var/log/seekall

# 9. 重启 PM2
echo "🔄 重启 PM2 进程..."
pm2 startOrReload ecosystem.config.cjs --env production
pm2 save

# 10. 创建超级管理员（首次部署）
echo ""
echo "====== 部署完成 ======"
echo ""
echo "下一步："
echo "  1. 首次部署需创建管理员：pnpm --filter api cli:setup-admin <username> <email> <password>"
echo "  2. 初始化用户协议：pnpm --filter api prisma:seed"
echo "  3. 检查服务状态：pm2 status"
echo "  4. 查看日志：pm2 logs seekall-api"
echo "  5. 健康检查：curl http://localhost:7301/api/v1/health"
echo ""
echo "访问地址："
echo "  前端: http://localhost:7300"
echo "  API:  http://localhost:7301"
echo "  域名: https://seekall.winmelon.cn（需 Caddy 已配置）"
