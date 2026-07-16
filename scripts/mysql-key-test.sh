#!/bin/bash
# Test MySQL key length limits
set -e
for len in 512 768 1024 2048; do
  echo "=== Trying VARCHAR($len) ==="
  ssh -p 22022 -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=accept-new root@<REDACTED_SERVER_IP> "docker exec seekall-mysql mysql -u root -p<REDACTED_MYSQL_PASS> -e \"
USE seekall;
DROP TABLE IF EXISTS test_k;
CREATE TABLE test_k (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  resource_url VARCHAR($len) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE INDEX test_k_uniq (user_id, resource_url)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SHOW CREATE TABLE test_k\\G
\" 2>&1 | head -20"
  echo
done