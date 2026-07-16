#!/bin/bash
# Test the exact favorites table from 0_init
ssh -p 22022 -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=accept-new root@<REDACTED_SERVER_IP> 'docker exec seekall-mysql mysql -u root -p<REDACTED_MYSQL_PASS> -e "
USE seekall;
DROP TABLE IF EXISTS favorites_test;
CREATE TABLE \`favorites_test\` (
    \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    \`user_id\` BIGINT UNSIGNED NOT NULL,
    \`resource_url\` VARCHAR(512) NOT NULL,
    \`title\` VARCHAR(255) NOT NULL,
    \`source\` VARCHAR(64) NOT NULL,
    \`category\` VARCHAR(32) NULL,
    \`resource_meta\` JSON NULL,
    \`created_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX \`favorites_user_id_created_at_idx\`(\`user_id\`, \`created_at\`),
    UNIQUE INDEX \`favorites_user_id_resource_url_key\`(\`user_id\`, \`resource_url\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SHOW CREATE TABLE favorites_test\\G
" 2>&1' 2>&1 | head -25