#!/bin/bash
# 部署 seekall-user-spa 到服务器
# 阶段 10: DNS + git pull + docker build + nginx vhost + certbot + 验证

set -uo pipefail

echo "=== 1. git pull ~/seekall ==="
cd ~/seekall
GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519_seekall_deploy -o IdentitiesOnly=yes" git pull origin master 2>&1 | tail -5

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
echo "=== 3. docker compose build seekall-user-spa ==="
cd /opt/seekall-v0.5/docker
sudo docker compose build seekall-user-spa 2>&1 | tail -10

echo ""
echo "=== 4. docker compose up seekall-user-spa ==="
sudo docker compose up -d --no-deps seekall-user-spa 2>&1 | tail -5

echo ""
echo "=== 5. wait 15s + verify container ==="
sleep 15
sudo docker ps --filter "name=seekall-user-spa" --format "{{.Names}} {{.Status}}"
echo -n "container health: "
curl -sS http://172.18.0.8/health 2>&1
echo

echo ""
echo "=== DEPLOY STAGES 3-5 DONE (container up) ==="
echo "=== NEXT: nginx vhost + certbot (需 root SSH 执行) ==="
