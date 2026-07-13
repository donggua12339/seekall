# 觅源 SeekAll - MySQL 初始化脚本
# 仅在首次创建数据库时执行

-- 字符集
ALTER DATABASE seekall CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 时区
SET GLOBAL time_zone = '+08:00';
SET SESSION time_zone = '+08:00';

-- 性能优化（根据服务器配置调整）
SET GLOBAL innodb_buffer_pool_size = 536870912;  -- 512MB
SET GLOBAL innodb_log_file_size = 134217728;     -- 128MB
SET GLOBAL max_connections = 100;
SET GLOBAL innodb_file_per_table = ON;
