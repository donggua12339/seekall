-- SeekAll v0.4.2: URL 字段扩容
-- 修复长 URL（>512 字符）写入失败问题，统一为 VarChar(2048)
-- 涉及表：favorites / takedown_records / collection_items
--
-- 重要：resource_url 改为 2048 后，复合 unique 索引会超 3072 字节（utf8mb4: 2048*4=8192）
-- 必须先 DROP unique 索引，再 MODIFY COLUMN，最后用前缀索引重建

-- favorites：先删 unique，改用前缀索引
ALTER TABLE `favorites` DROP INDEX `favorites_user_id_resource_url_key`;
ALTER TABLE `favorites` MODIFY COLUMN `resource_url` VARCHAR(2048) NOT NULL;
ALTER TABLE `favorites` MODIFY COLUMN `title` VARCHAR(512) NOT NULL;
ALTER TABLE `favorites` ADD INDEX `favorites_user_id_resource_url_idx`(`user_id`, `resource_url`(255));

-- takedown_records：仅 MODIFY（无复合 unique 在 resource_url）
ALTER TABLE `takedown_records` MODIFY COLUMN `resource_url` VARCHAR(2048) NOT NULL;

-- collection_items：先删 unique，改用前缀索引
ALTER TABLE `collection_items` DROP INDEX `collection_id_resource_url_key`;
ALTER TABLE `collection_items` MODIFY COLUMN `resource_url` VARCHAR(2048) NOT NULL;
ALTER TABLE `collection_items` MODIFY COLUMN `title` VARCHAR(512) NOT NULL;
ALTER TABLE `collection_items` ADD INDEX `collection_id_resource_url_idx`(`collection_id`, `resource_url`(255));