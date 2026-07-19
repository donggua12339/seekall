#!/bin/bash
# set -e  -- 注释掉,health check 失败不退出

echo "=== 1. git pull on ~/seekall ==="
cd ~/seekall
GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519_seekall_deploy -o IdentitiesOnly=yes" git pull origin master 2>&1 | tail -10

echo ""
echo "=== 2. cp code to /opt/seekall-v0.5 (preserve .env) ==="
sudo docker run --rm -v /opt:/opt -v /home/<REDACTED_SSH_USER>:/home alpine:3.18 sh -c '
  mkdir -p /opt/seekall-env-backup
  cp /opt/seekall-v0.5/.env /opt/seekall-env-backup/.env
  cp /opt/seekall-v0.5/.env.production /opt/seekall-env-backup/.env.production
  cp /opt/seekall-v0.5/docker/.env /opt/seekall-env-backup/docker.env
  rm -rf /opt/seekall-v0.5
  cp -a /home/seekall /opt/seekall-v0.5
  chown -R root:root /opt/seekall-v0.5
  cp /opt/seekall-env-backup/.env /opt/seekall-v0.5/.env
  cp /opt/seekall-env-backup/.env.production /opt/seekall-v0.5/.env.production
  cp /opt/seekall-env-backup/docker.env /opt/seekall-v0.5/docker/.env
  rm -rf /opt/seekall-env-backup
'
echo "cp done"

echo ""
echo "=== 3. docker compose build seekall-api ==="
cd /opt/seekall-v0.5/docker
sudo docker compose build seekall-api 2>&1 | tail -15

echo ""
echo "=== 4. docker compose up seekall-api ==="
sudo docker compose up -d --no-deps seekall-api 2>&1 | tail -10

echo ""
echo "=== 5. wait 20s + health check ==="
sleep 20
curl -sS http://172.18.0.5:7301/api/v1/health || echo "(health check failed, container may still be starting)"
echo

echo ""
echo "=== 6. wm-webhook test (expect signature error, NOT 401) ==="
curl -sS -X POST -H "Content-Type: application/json" \
  http://172.18.0.5:7301/api/v1/license/wm-webhook \
  -d '{"wmOrderId":"test","tier":"trial","amount":1,"signature":"invalid"}' || echo "(wm-webhook test failed)"
echo

echo ""
echo "=== 7. container status ==="
sudo docker ps --filter "name=seekall-api" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "=== DEPLOY DONE ==="
