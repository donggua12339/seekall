#!/bin/bash

ARCHIVE_FILE="/opt/seekall-v0.4.1-archive-20260718/WM_WEBHOOK_SECRET.txt"

echo "=== 1. read secret ==="
SECRET=$(sudo docker run --rm -v /opt:/opt alpine:3.18 cat "$ARCHIVE_FILE" 2>/dev/null | tr -d '[:space:]')
if [ -z "$SECRET" ]; then
  echo "(failed to read secret)"
  exit 1
fi
echo "(secret length: ${#SECRET})"

echo ""
echo "=== 2. append to .env if missing (using grep -q) ==="
if sudo docker run --rm -v /opt:/opt alpine:3.18 sh -c "grep -q WM_WEBHOOK_SECRET /opt/seekall-v0.5/.env 2>/dev/null"; then
  echo "(.env already has it)"
else
  sudo docker run --rm -v /opt:/opt -e SECRET="$SECRET" alpine:3.18 sh -c 'printf "\nWM_WEBHOOK_SECRET=%s\n" "$SECRET" >> /opt/seekall-v0.5/.env'
  echo "(appended to .env)"
fi

if sudo docker run --rm -v /opt:/opt alpine:3.18 sh -c "grep -q WM_WEBHOOK_SECRET /opt/seekall-v0.5/docker/.env 2>/dev/null"; then
  echo "(docker/.env already has it)"
else
  sudo docker run --rm -v /opt:/opt -e SECRET="$SECRET" alpine:3.18 sh -c 'printf "\nWM_WEBHOOK_SECRET=%s\n" "$SECRET" >> /opt/seekall-v0.5/docker/.env'
  echo "(appended to docker/.env)"
fi

echo ""
echo "=== 3. verify .env has WM_WEBHOOK_SECRET ==="
echo -n ".env count: "
sudo docker run --rm -v /opt:/opt alpine:3.18 sh -c "grep -c WM_WEBHOOK_SECRET /opt/seekall-v0.5/.env 2>/dev/null || echo 0"
echo -n "docker/.env count: "
sudo docker run --rm -v /opt:/opt alpine:3.18 sh -c "grep -c WM_WEBHOOK_SECRET /opt/seekall-v0.5/docker/.env 2>/dev/null || echo 0"

echo ""
echo "=== 4. force recreate seekall-api ==="
cd /opt/seekall-v0.5/docker
sudo docker compose up -d --no-deps --force-recreate seekall-api 2>&1 | tail -5

echo ""
echo "=== 5. wait 20s + verify container env ==="
sleep 20
echo -n "container env WM_WEBHOOK_SECRET count: "
sudo docker exec seekall-api env 2>/dev/null | grep -c "WM_WEBHOOK_SECRET"

echo ""
echo "=== 6. health check ==="
curl -sS http://172.18.0.5:7301/api/v1/health
echo

echo ""
echo "=== 7. wm-webhook test (expect signature mismatch error) ==="
curl -sS -X POST -H "Content-Type: application/json" \
  http://172.18.0.5:7301/api/v1/license/wm-webhook \
  -d '{"wmOrderId":"test","tier":"trial","amount":1,"signature":"invalid"}'
echo

echo ""
echo "=== FIX DONE ==="
