#!/bin/bash

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
echo "=== 3. docker compose build seekall-admin ==="
cd /opt/seekall-v0.5/docker
sudo docker compose build seekall-admin 2>&1 | tail -15

echo ""
echo "=== 4. docker compose up seekall-admin ==="
sudo docker compose up -d --no-deps seekall-admin 2>&1 | tail -5

echo ""
echo "=== 5. wait 15s + verify ==="
sleep 15
echo -n "container status: "
sudo docker ps --filter "name=seekall-admin" --format "{{.Names}} {{.Status}}"
echo -n "health (internal): "
curl -sS http://172.18.0.7/health 2>&1
echo
echo -n "admin external: "
curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://admin.seekall.winmelon.cn/ 2>&1

echo ""
echo "=== DEPLOY DONE ==="
