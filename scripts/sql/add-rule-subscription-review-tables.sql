-- SeekAll v0.5 P2-2: 新增 RuleSubscription + RuleReview 独立表
-- 从 AdminAuditLog 拆出，提供：
--   1. 订阅幂等（unique 约束 + 取消订阅直接 delete）
--   2. 评审一人一票（unique 约束）
--   3. 查询效率（不再需要 JsonFilter 扫描 AdminAuditLog）

CREATE TABLE IF NOT EXISTS `rule_subscriptions` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `user_id` BIGINT UNSIGNED NOT NULL,
    `rule_id` BIGINT UNSIGNED NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    UNIQUE INDEX `rule_subscriptions_user_id_rule_id_key`(`user_id`, `rule_id`),
    INDEX `rule_subscriptions_user_id_idx`(`user_id`),
    INDEX `rule_subscriptions_rule_id_idx`(`rule_id`),
    CONSTRAINT `rule_subscriptions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    CONSTRAINT `rule_subscriptions_rule_id_fkey` FOREIGN KEY (`rule_id`) REFERENCES `rules`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `rule_reviews` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `rule_id` BIGINT UNSIGNED NOT NULL,
    `reviewer_id` BIGINT UNSIGNED NOT NULL,
    `approve` BOOLEAN NOT NULL,
    `comment` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    UNIQUE INDEX `rule_reviews_rule_id_reviewer_id_key`(`rule_id`, `reviewer_id`),
    INDEX `rule_reviews_rule_id_idx`(`rule_id`),
    INDEX `rule_reviews_reviewer_id_idx`(`reviewer_id`),
    CONSTRAINT `rule_reviews_rule_id_fkey` FOREIGN KEY (`rule_id`) REFERENCES `rules`(`id`) ON DELETE CASCADE,
    CONSTRAINT `rule_reviews_reviewer_id_fkey` FOREIGN KEY (`reviewer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 可选：迁移历史 AdminAuditLog 中的 rule_subscribe / rule_review 到新表
-- 跳过：v0.5 上线初无用户数据，AdminAuditLog 中无历史订阅/评审记录
