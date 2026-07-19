#!/bin/bash

echo "=== 1. .env file has WM_WEBHOOK_SECRET? ==="
grep -c "WM_WEBHOOK_SECRET" /opt/seekall-v0.5/docker/.env 2>/dev/null || echo "(not found in docker/.env)"
grep -c "WM_WEBHOOK_SECRET" /opt/seekall-v0.5/.env 2>/dev/null || echo "(not found in .env)"

echo ""
echo "=== 2. docker-compose.yml environment section ==="
grep -A 2 "WM_WEBHOOK" /opt/seekall-v0.5/docker/docker-compose.yml 2>/dev/null || echo "(WM_WEBHOOK not in docker-compose.yml)"

echo ""
echo "=== 3. container env (seekall-api) ==="
sudo docker exec seekall-api env 2>/dev/null | grep -i "WM_WEBHOOK\|WEBHOOK" || echo "(WM_WEBHOOK_SECRET not in container env)"

echo ""
echo "=== 4. config.validator.ts WM_WEBHOOK_SECRET requirement ==="
grep -n "WM_WEBHOOK_SECRET" /opt/seekall-v0.5/apps/api/src/infrastructure/config/config.validator.ts 2>/dev/null || echo "(not in config.validator.ts)"

echo ""
echo "=== DIAG DONE ==="
