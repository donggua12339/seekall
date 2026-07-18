-- SeekAll v0.5 P2-1: 新增 DMCA Takedown Notice 表
-- 用途：公众通过 POST /api/v1/dmca/notice 提交版权侵权举报
-- 字段对齐 DMCA §512(c) Takedown Notice 7 项必填要素
-- 处理流程：pending -> verified / rejected -> actioned
-- 合规要求：takedown 记录永不删除（R4 + 透明度报告）

CREATE TABLE IF NOT EXISTS `dmca_notices` (
    `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `infringing_url` VARCHAR(500) NOT NULL COMMENT '侵权 URL（规则详情页或外部资源 URL）',
    `rule_id` BIGINT UNSIGNED NULL COMMENT '关联到具体 Rule（admin 复核时关联）',
    `original_title` VARCHAR(255) NOT NULL COMMENT '原作品标题',
    `copyright_owner` VARCHAR(255) NOT NULL COMMENT '版权所有者',
    `reporter_email` VARCHAR(128) NOT NULL COMMENT '举报人邮箱',
    `reporter_role` ENUM('owner', 'agent') NOT NULL COMMENT '举报人身份（owner 版权所有者 / agent 授权代表）',
    `good_faith_statement` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '善意声明（必须为 true）',
    `accuracy_statement` BOOLEAN NOT NULL DEFAULT FALSE COMMENT '准确性声明（必须为 true）',
    `electronic_signature` VARCHAR(128) NOT NULL COMMENT '电子签名（typed name）',
    `notes` TEXT NULL COMMENT '可选额外说明',
    `status` ENUM('pending', 'verified', 'actioned', 'rejected') NOT NULL DEFAULT 'pending',
    `handler_admin_id` BIGINT UNSIGNED NULL COMMENT '处理人 admin id',
    `handler_note` VARCHAR(500) NULL COMMENT '处理备注',
    `handled_at` DATETIME(3) NULL COMMENT '处理时间',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`),
    INDEX `dmca_notices_status_idx`(`status`),
    INDEX `dmca_notices_rule_id_idx`(`rule_id`),
    INDEX `dmca_notices_created_at_idx`(`created_at`),
    INDEX `dmca_notices_handler_admin_id_idx`(`handler_admin_id`),
    CONSTRAINT `dmca_notices_rule_id_fkey` FOREIGN KEY (`rule_id`) REFERENCES `rules`(`id`) ON DELETE SET NULL,
    CONSTRAINT `dmca_notices_handler_admin_id_fkey` FOREIGN KEY (`handler_admin_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
