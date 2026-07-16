#!/bin/bash
# Test adding FKs to existing tables
ssh -p 22022 -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=accept-new root@<REDACTED_SERVER_IP> 'docker exec seekall-mysql mysql -u root -p<REDACTED_MYSQL_PASS> -e "
USE seekall;
ALTER TABLE favorites ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
" 2>&1' 2>&1 | head -5