#!/bin/bash

echo "=== 1. git pull ~/seekall ==="
cd ~/seekall
GIT_SSH_COMMAND="ssh -i ~/.ssh/id_ed25519_seekall_deploy -o IdentitiesOnly=yes" git pull origin master 2>&1 | tail -5

echo ""
echo "=== 2. cp docker-compose.yml + backup-cron.sh to /opt ==="
sudo docker run --rm -v /opt:/opt -v /home/<REDACTED_SSH_USER>:/home alpine:3.18 sh -c '
  cp /home/seekall/docker/docker-compose.yml /opt/seekall-v0.5/docker/docker-compose.yml
  cp /home/seekall/scripts/backup-cron.sh /opt/seekall-v0.5/scripts/backup-cron.sh
  chmod +x /opt/seekall-v0.5/scripts/backup-cron.sh
  chown root:root /opt/seekall-v0.5/docker/docker-compose.yml /opt/seekall-v0.5/scripts/backup-cron.sh
'
echo "cp done"

echo ""
echo "=== 3. recreate redis (apply --dir /data) ==="
cd /opt/seekall-v0.5/docker
sudo docker compose up -d --no-deps --force-recreate redis 2>&1 | tail -5

echo ""
echo "=== 4. wait 5s + verify redis dir ==="
sleep 5
echo -n "CONFIG GET dir: "
sudo docker exec -w / seekall-redis redis-cli CONFIG GET dir 2>&1
echo -n "DBSIZE: "
sudo docker exec -w / seekall-redis redis-cli DBSIZE 2>&1

echo ""
echo "=== 5. 跑 backup-cron.sh 验证 Redis dump ==="
/opt/seekall-v0.5/scripts/backup-cron.sh 2>&1 | tail -10

echo ""
echo "=== 6. 备份目录 ==="
ls -la /opt/seekall-backups/ 2>/dev/null | tail -3
ls -la /opt/seekall-backups/$(ls -t /opt/seekall-backups/ | head -1)/ 2>/dev/null

echo ""
echo "=== DEPLOY DONE ==="
