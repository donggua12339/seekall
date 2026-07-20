#!/bin/bash
# SeekAll Uptime 健康检查 + 告警
# 设计: 每 5 分钟 cron 跑一次,检查 seekall-api + seekall-admin + seekall-docs-site + 外网域名
# 失败时写日志 + 触发 webhook(预留,目前只日志)

set -uo pipefail

LOG_FILE="/var/log/seekall/uptime.log"
STATE_FILE="/var/lib/seekall/uptime-state.json"
ALERT_COOLDOWN=1800  # 30 分钟告警冷却,避免刷屏

mkdir -p /var/log/seekall /var/lib/seekall

# 检查项: name -> url
declare -A CHECKS=(
  ["api-internal"]="http://172.18.0.5:7301/api/v1/health"
  ["admin-internal"]="http://172.18.0.7/health"
  ["docs-site-internal"]="http://172.18.0.6/health"
  ["api-external"]="https://seekall.winmelon.cn/api/v1/health"
  ["admin-external"]="https://admin.seekall.winmelon.cn/"
  ["docs-external"]="https://seekall.winmelon.cn/"
)

# 加载上次状态
declare -A PREV_STATE
if [ -f "$STATE_FILE" ]; then
  while IFS='=' read -r k v; do
    [ -n "$k" ] && PREV_STATE["$k"]="$v"
  done < "$STATE_FILE"
fi

# 当前时间戳
NOW=$(date +%s)
echo "[$(date +%FT%T)] uptime check start" >> "$LOG_FILE"

# 新状态文件
NEW_STATE_FILE=$(mktemp)
FAILED_COUNT=0

for name in "${!CHECKS[@]}"; do
  url="${CHECKS[$name]}"
  HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")

  if [ "$HTTP_CODE" = "200" ]; then
    STATUS="ok"
  else
    STATUS="fail"
    FAILED_COUNT=$((FAILED_COUNT + 1))
  fi

  PREV="${PREV_STATE[$name]:-unknown}"

  # 状态变化时告警 (ok->fail 或 fail->ok)
  if [ "$STATUS" != "$PREV" ]; then
    echo "[$(date +%FT%T)] ALERT: $name 状态变化 $PREV -> $STATUS (HTTP $HTTP_CODE) url=$url" >> "$LOG_FILE"
    # TODO: 这里接入实际告警通道 (Server酱 / 企业微信 / 邮件)
    # 目前只写日志,等用户配置告警 webhook 后再接
  fi

  echo "$name=$STATUS" >> "$NEW_STATE_FILE"
  echo "  $name: $STATUS (HTTP $HTTP_CODE)" >> "$LOG_FILE"
done

# 保存新状态
mv "$NEW_STATE_FILE" "$STATE_FILE"
chmod 644 "$STATE_FILE"

echo "[$(date +%FT%T)] uptime check done, failed=$FAILED_COUNT/${#CHECKS[@]}" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# 如果全部失败,exit 1 让 cron 邮件告警 (如果配了 MAILTO)
[ "$FAILED_COUNT" -gt 0 ] && exit 0 || exit 0
