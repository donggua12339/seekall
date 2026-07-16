#!/bin/bash
# Test collection_items table creation
ssh -p 22022 -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=accept-new root@<REDACTED_SERVER_IP> 'docker exec seekall-mysql mysql -u root -p<REDACTED_MYSQL_PASS> -e "
USE seekall;
CREATE TABLE \`collection_items\` (
    \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    \`collection_id\` BIGINT UNSIGNED NOT NULL,
    \`resource_url\` VARCHAR(2048) NOT NULL,
    \`title\` VARCHAR(512) NOT NULL,
    \`source\` VARCHAR(64) NULL,
    \`file_type\` VARCHAR(32) NULL,
    \`added_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX \`collection_id_resource_url_idx\`(\`collection_id\`, \`resource_url\`(255)),
    INDEX \`collection_id_added_at_idx\`(\`collection_id\`, \`added_at\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
" 2>&1' 2>&1 | head -10