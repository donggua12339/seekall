#!/usr/bin/env bash
# 觅源 SeekAll - 数据备份脚本
# 用法：./backup.sh
# crontab: 0 3 * * * /path/to/seekall/backup.sh

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/data/backups/seekall}"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# 从 .env 读取配置
if [ -f "$PROJECT_DIR/.env" ]; then
  # shellcheck disable=SC1090
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

DB_NAME="${MYSQL_DATABASE:-seekall}"
DB_USER="${MYSQL_USER:-seekall}"
DB_PASSWORD="${MYSQL_PASSWORD:-seekall_password}"

mkdir -p "$BACKUP_DIR"
echo "====== 觅源 SeekAll 备份 ======"
echo "备份目录: $BACKUP_DIR"
echo "日期: $DATE"
echo ""

# 1. MySQL 备份
echo "📦 备份 MySQL..."
MYSQL_DUMP="$BACKUP_DIR/mysql_${DATE}.sql.gz"
mysqldump -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" 2>/dev/null | gzip > "$MYSQL_DUMP"
echo "  ✓ $MYSQL_DUMP ($(du -h "$MYSQL_DUMP" | cut -f1))"

# 2. Redis 备份（RDB 快照）
echo "📦 备份 Redis..."
REDIS_DUMP="$BACKUP_DIR/redis_${DATE}.rdb"
redis-cli BGSAVE 2>/dev/null || true
sleep 2
if [ -f /var/lib/redis/dump.rdb ]; then
  cp /var/lib/redis/dump.rdb "$REDIS_DUMP"
  echo "  ✓ $REDIS_DUMP"
fi

# 3. Meilisearch 快照
echo "📦 备份 Meilisearch..."
MEILI_URL="${MEILISEARCH_URL:-http://localhost:7700}"
MEILI_KEY="${MEILISEARCH_MASTER_KEY:-}"
MEILI_SNAPSHOT="$BACKUP_DIR/meili_${DATE}.dump"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$MEILI_URL/snapshots" \
  -H "Authorization: Bearer $MEILI_KEY" 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "202" ] || [ "$HTTP_CODE" = "200" ]; then
  echo "  ✓ Meilisearch snapshot 已触发"
else
  echo "  ⚠ Meilisearch 备份失败 (HTTP $HTTP_CODE)"
fi

# 4. 清理过期备份
echo "🧹 清理 ${RETENTION_DAYS} 天前的备份..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "*.rdb" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
find "$BACKUP_DIR" -name "*.dump" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

echo ""
echo "====== 备份完成 ======"
echo "总大小: $(du -sh "$BACKUP_DIR" | cut -f1)"
echo "文件数: $(find "$BACKUP_DIR" -type f | wc -l)"
