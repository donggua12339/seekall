#!/usr/bin/env bash
# 觅源 SeekAll - HK 服务器一键部署脚本
# 用法（你已经 SSH 进 root@RainYun-CMIHqacw）：
#   bash /tmp/deploy-seekall.sh
#
# 此脚本会：
#   1. 拉取最新代码（git pull 或新建项目目录 + 推送）
#   2. cp .env.production .env
#   3. cd docker && docker compose build --no-cache
#   4. docker compose up -d
#   5. 健康检查 + 端口验证
#
# 前提：你已经把你机器上的代码 rsync 到服务器（见下文 SC 别名）

set -euo pipefail

PROJ_DIR="${PROJ_DIR:-/opt/seekall}"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/data/backups/seekall/$DATE"

echo "====== 觅源 SeekAll 部署 ======"
echo "项目目录: $PROJ_DIR"
echo "备份目录: $BACKUP_DIR"
echo ""

# 1. 备份现有数据（防止 docker compose up 抹掉 volumes）
echo "[1/7] 备份 MySQL + Redis 数据..."
mkdir -p "$BACKUP_DIR"
docker exec seekall-mysql mysqldump -u"${MYSQL_USER:-seekall}" \
  -p"${MYSQL_PASSWORD:-seekall_password}" \
  "${MYSQL_DATABASE:-seekall}" 2>/dev/null | gzip > "$BACKUP_DIR/mysql.sql.gz" || echo "  ⚠ mysql dump 跳过（容器未在跑？）"
docker exec seekall-redis redis-cli BGSAVE 2>/dev/null || echo "  ⚠ redis BGSAVE 跳过"
sleep 2
docker cp seekall-redis:/data/dump.rdb "$BACKUP_DIR/redis.rdb" 2>/dev/null || echo "  ⚠ redis dump copy 跳过"

# 2. 拉取最新代码
echo "[2/7] 拉取最新代码..."
if [ ! -d "$PROJ_DIR/.git" ]; then
  echo "  ⚠ $PROJ_DIR 不是 git 仓库，请先 rsync 代码过去："
  echo "    在本地机器运行: scp -r 'D:\\soft\\Claude Code Haha\\seekall' root@<REDACTED_SERVER_IP>:$PROJ_DIR"
  exit 1
fi
cd "$PROJ_DIR"
git fetch --all
git reset --hard origin/master  # 用 master 主分支，包含 fix 47a9022
echo "  ✓ 当前 commit: $(git rev-parse --short HEAD)"
echo "    信息: $(git log -1 --pretty=%s)"

# 3. 环境变量
if [ ! -f "$PROJ_DIR/.env" ]; then
  echo "[3/7] 创建 .env（从 .env.production 复制）..."
  cp "$PROJ_DIR/.env.production" "$PROJ_DIR/.env"
  echo "  ⚠ 已复制 .env.production → .env，请人工校对密钥"
else
  echo "[3/7] .env 已存在，跳过"
fi

# 4. 构建镜像
echo "[4/7] docker compose build（这步需要 5-15 分钟）..."
cd "$PROJ_DIR/docker"
docker compose build --no-cache 2>&1 | tail -40

# 5. 启动
echo "[5/7] docker compose up -d..."
docker compose up -d

# 6. 等就绪
echo "[6/7] 等待服务启动..."
for i in {1..30}; do
  if curl -sS -m 2 http://localhost:7301/api/v1/health >/dev/null 2>&1; then
    echo "  ✓ API ready (${i}×2s)"
    break
  fi
  sleep 2
done

# 7. 验证
echo "[7/7] 验证部署..."
echo "--- 健康检查 ---"
curl -sS http://localhost:7301/api/v1/health | head -c 300
echo ""
echo "--- 容器状态 ---"
docker compose ps
echo "--- 端口监听 ---"
ss -tlnp | grep -E ":(3306|6379|7700|7300|7301|80|443|8789)" || true
echo ""
echo "====== 部署完成 ======"
echo "API:  http://localhost:7301/api/v1/health"
echo "Web:  http://localhost:7300"
echo "PanSou (自建): http://localhost:8789"
echo ""
echo "如果 80/443 端口被 caddy 反代占用："
echo "  curl -H 'Host: seekall.winmelon.cn' http://localhost:7300/  # 应返回 Nuxt 首页"
