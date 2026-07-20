#!/usr/bin/env bash
# 觅源 SeekAll - HK 服务器定时备份 cron wrapper
# 安装：crontab -e，加一行：
#   0 3 * * * /opt/seekall-v0.5/scripts/backup-cron.sh >> /var/log/seekall/backup.log 2>&1
#
# 行为：每天 3 点执行
#   1. MySQL dump (via docker exec seekall-mysql)
#   2. Redis BGSAVE (via docker exec seekall-redis)
#   3. Meilisearch 异步 snapshot
#   4. 清理 30 天前的旧备份
#
# 不依赖 .env 读取（避免反斜杠 / <> 字符破坏 bash source）

set -euo pipefail

BACKUP_BASE="/opt/seekall-backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="${BACKUP_BASE}/${DATE}"
RETENTION_DAYS=30

mkdir -p "${BACKUP_PATH}"
echo "[$(date +%FT%T)] 备份开始 → ${BACKUP_PATH}"

# ---------- 1. MySQL ----------
echo "  - MySQL dump..."
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^seekall-mysql$'; then
  # 从 docker inspect 拿 MYSQL_ROOT_PASSWORD 注入到容器
  MYSQL_ROOT_PWD=$(docker inspect seekall-mysql --format='{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep '^MYSQL_ROOT_PASSWORD=' | cut -d= -f2-)
  if [ -z "${MYSQL_ROOT_PWD:-}" ]; then
    # 没有 root 密码，用环境变量中的 MYSQL_PASSWORD（通过 .env 注入）
    MYSQL_USER=$(docker inspect seekall-mysql --format='{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep '^MYSQL_USER=' | cut -d= -f2-)
    MYSQL_PWD=$(docker inspect seekall-mysql --format='{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep '^MYSQL_PASSWORD=' | cut -d= -f2-)
    MYSQL_DB=$(docker inspect seekall-mysql --format='{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep '^MYSQL_DATABASE=' | cut -d= -f2-)
    docker exec seekall-mysql sh -c "mysqldump -u'${MYSQL_USER}' -p'${MYSQL_PWD}' '${MYSQL_DB}'" 2>/dev/null | gzip > "${BACKUP_PATH}/mysql.sql.gz"
  else
    MYSQL_DB=$(docker inspect seekall-mysql --format='{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep '^MYSQL_DATABASE=' | cut -d= -f2-)
    docker exec seekall-mysql sh -c "mysqldump -u'root' -p'${MYSQL_ROOT_PWD}' '${MYSQL_DB}'" 2>/dev/null | gzip > "${BACKUP_PATH}/mysql.sql.gz"
  fi
else
  echo "    ! seekall-mysql 容器未运行，跳过 MySQL dump"
fi

# ---------- 2. Redis ----------
echo "  - Redis dump..."
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^seekall-redis$'; then
  docker exec -w / seekall-redis redis-cli BGSAVE 2>/dev/null || true
  sleep 2
  docker cp seekall-redis:/data/dump.rdb "${BACKUP_PATH}/redis.rdb" 2>/dev/null || \
    echo "    ! Redis dump copy 失败"
fi

# ---------- 3. Meilisearch ----------
echo "  - Meilisearch snapshot..."
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q '^seekall-meilisearch$'; then
  MEILI_MASTER_KEY=$(docker inspect seekall-meilisearch --format='{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep '^MEILISEARCH_MASTER_KEY=' | cut -d= -f2-)
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST 'http://localhost:7700/snapshots' \
    -H "Authorization: Bearer ${MEILI_MASTER_KEY}" 2>/dev/null || echo "000")
  echo "    snapshot HTTP ${HTTP_CODE}"
fi

# ---------- 4. 备份元信息 ----------
cat > "${BACKUP_PATH}/_meta.json" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "host": "$(hostname)",
  "components": ["mysql", "redis", "meilisearch"]
}
EOF

# ---------- 5. 清理过期 ----------
find "${BACKUP_BASE}" -mindepth 1 -maxdepth 1 -mtime +${RETENTION_DAYS} -exec rm -rf {} \; 2>/dev/null || true

# ---------- 6. 汇报 ----------
SIZE=$(du -sh "${BACKUP_PATH}" | cut -f1)
TOTAL=$(du -sh "${BACKUP_BASE}" | cut -f1)
COUNT=$(find "${BACKUP_BASE}" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
echo "[$(date +%FT%T)] 备份完成: ${SIZE} | 总计 ${TOTAL} | 保留 ${COUNT} 份"
