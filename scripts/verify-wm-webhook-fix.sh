#!/bin/bash

echo "=== seekall-api container status ==="
sudo docker ps --filter "name=seekall-api" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "=== api logs tail 20 ==="
sudo docker logs seekall-api --tail 20 2>&1

echo ""
echo "=== health check (internal) ==="
curl -sS http://172.18.0.5:7301/api/v1/health
echo

echo ""
echo "=== wm-webhook test internal (expect signature error, NOT 401) ==="
curl -sS -X POST -H "Content-Type: application/json" \
  http://172.18.0.5:7301/api/v1/license/wm-webhook \
  -d '{"wmOrderId":"test","tier":"trial","amount":1,"signature":"invalid"}'
echo

echo ""
echo "=== VERIFY DONE ==="
