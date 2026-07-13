-- CreateTable
CREATE TABLE `users` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `username` VARCHAR(32) NOT NULL,
    `email` VARCHAR(128) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `role` ENUM('super_admin', 'user') NOT NULL DEFAULT 'user',
    `is_paid` BOOLEAN NOT NULL DEFAULT false,
    `paid_until` DATETIME(3) NULL,
    `status` ENUM('pending_verification', 'active', 'banned', 'deleted') NOT NULL DEFAULT 'pending_verification',
    `banned_reason` VARCHAR(255) NULL,
    `badge` VARCHAR(64) NULL,
    `avatar_url` VARCHAR(255) NULL,
    `bio` VARCHAR(200) NULL,
    `email_verify_token` VARCHAR(64) NULL,
    `email_verified_at` DATETIME(3) NULL,
    `password_reset_token` VARCHAR(64) NULL,
    `password_reset_expires` DATETIME(3) NULL,
    `github_id` VARCHAR(64) NULL,
    `github_username` VARCHAR(64) NULL,
    `last_login_at` DATETIME(3) NULL,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_github_id_key`(`github_id`),
    INDEX `users_status_idx`(`status`),
    INDEX `users_is_paid_idx`(`is_paid`),
    INDEX `users_deleted_at_idx`(`deleted_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_preferences` (
    `userId` BIGINT UNSIGNED NOT NULL,
    `preferred_categories` JSON NULL,
    `preferred_providers` JSON NULL,
    `theme` VARCHAR(16) NOT NULL DEFAULT 'auto',
    `language` VARCHAR(10) NOT NULL DEFAULT 'zh-CN',
    `search_page_size` INTEGER NOT NULL DEFAULT 20,
    `safe_search` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `invite_codes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(8) NOT NULL,
    `status` ENUM('unused', 'used', 'disabled') NOT NULL DEFAULT 'unused',
    `created_by_id` BIGINT UNSIGNED NOT NULL,
    `used_by_id` BIGINT UNSIGNED NULL,
    `used_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `invite_codes_code_key`(`code`),
    UNIQUE INDEX `invite_codes_used_by_id_key`(`used_by_id`),
    INDEX `invite_codes_status_idx`(`status`),
    INDEX `invite_codes_created_by_id_idx`(`created_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `membership_codes` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(16) NOT NULL,
    `status` ENUM('unused', 'used', 'disabled') NOT NULL DEFAULT 'unused',
    `duration_days` INTEGER NOT NULL,
    `created_by_id` BIGINT UNSIGNED NOT NULL,
    `used_by_id` BIGINT UNSIGNED NULL,
    `used_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `membership_codes_code_key`(`code`),
    INDEX `membership_codes_status_idx`(`status`),
    INDEX `membership_codes_created_by_id_idx`(`created_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `search_history` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `query` VARCHAR(255) NOT NULL,
    `filters` JSON NULL,
    `result_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `search_history_user_id_created_at_idx`(`user_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `search_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NULL,
    `query` VARCHAR(255) NOT NULL,
    `filters` JSON NULL,
    `result_count` INTEGER NOT NULL DEFAULT 0,
    `source` ENUM('web', 'api', 'admin') NOT NULL DEFAULT 'web',
    `duration_ms` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `search_logs_created_at_idx`(`created_at`),
    INDEX `search_logs_user_id_idx`(`user_id`),
    INDEX `search_logs_query_created_at_idx`(`query`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `favorites` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `resource_url` VARCHAR(512) NOT NULL,
    `title` VARCHAR(255) NOT NULL,
    `source` VARCHAR(64) NOT NULL,
    `category` VARCHAR(32) NULL,
    `resource_meta` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `favorites_user_id_created_at_idx`(`user_id`, `created_at`),
    UNIQUE INDEX `favorites_user_id_resource_url_key`(`user_id`, `resource_url`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `link_status` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `url_hash` VARCHAR(32) NOT NULL,
    `url` VARCHAR(512) NOT NULL,
    `status` ENUM('unknown', 'active', 'dead', 'checking') NOT NULL DEFAULT 'unknown',
    `last_checked_at` DATETIME(3) NULL,
    `fail_count` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `link_status_url_hash_key`(`url_hash`),
    INDEX `link_status_status_idx`(`status`),
    INDEX `link_status_last_checked_at_idx`(`last_checked_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `takedown_records` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `reporter_email` VARCHAR(128) NOT NULL,
    `resource_url` VARCHAR(512) NOT NULL,
    `reason` TEXT NOT NULL,
    `status` ENUM('pending', 'resolved', 'rejected') NOT NULL DEFAULT 'pending',
    `resolved_at` DATETIME(3) NULL,
    `resolved_by_id` BIGINT UNSIGNED NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `takedown_records_status_idx`(`status`),
    INDEX `takedown_records_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `blocked_keywords` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `keyword` VARCHAR(128) NOT NULL,
    `category` VARCHAR(32) NULL,
    `created_by_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `blocked_keywords_keyword_key`(`keyword`),
    INDEX `blocked_keywords_category_idx`(`category`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `agreements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `version` VARCHAR(16) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `effective_date` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `agreements_version_key`(`version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_agreements` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `agreement_version` VARCHAR(16) NOT NULL,
    `agreed_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `user_agreements_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin_audit_logs` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `admin_id` BIGINT UNSIGNED NOT NULL,
    `action` VARCHAR(64) NOT NULL,
    `target_type` VARCHAR(32) NOT NULL,
    `target_id` BIGINT UNSIGNED NULL,
    `detail` JSON NULL,
    `ip` VARCHAR(45) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `admin_audit_logs_admin_id_created_at_idx`(`admin_id`, `created_at`),
    INDEX `admin_audit_logs_target_type_target_id_idx`(`target_type`, `target_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `api_keys` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `key_hash` VARCHAR(128) NOT NULL,
    `name` VARCHAR(64) NOT NULL,
    `prefix` VARCHAR(16) NOT NULL,
    `last_used_at` DATETIME(3) NULL,
    `revoked_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `api_keys_key_hash_key`(`key_hash`),
    INDEX `api_keys_user_id_created_at_idx`(`user_id`, `created_at`),
    INDEX `api_keys_key_hash_idx`(`key_hash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_preferences` ADD CONSTRAINT `user_preferences_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invite_codes` ADD CONSTRAINT `invite_codes_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invite_codes` ADD CONSTRAINT `invite_codes_used_by_id_fkey` FOREIGN KEY (`used_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_codes` ADD CONSTRAINT `membership_codes_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `membership_codes` ADD CONSTRAINT `membership_codes_used_by_id_fkey` FOREIGN KEY (`used_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `search_history` ADD CONSTRAINT `search_history_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `search_logs` ADD CONSTRAINT `search_logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `takedown_records` ADD CONSTRAINT `takedown_records_resolved_by_id_fkey` FOREIGN KEY (`resolved_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `blocked_keywords` ADD CONSTRAINT `blocked_keywords_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_agreements` ADD CONSTRAINT `user_agreements_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_agreements` ADD CONSTRAINT `user_agreements_agreement_version_fkey` FOREIGN KEY (`agreement_version`) REFERENCES `agreements`(`version`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `admin_audit_logs` ADD CONSTRAINT `admin_audit_logs_admin_id_fkey` FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `api_keys` ADD CONSTRAINT `api_keys_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

