-- 把引擎内置规则注册进规则市场（published），用户才能在市场订阅、订阅才会接通搜索。
-- greenhub: 底座规则（搜索引擎永远执行，订阅与否都跑），这里登记仅为市场可见。
-- pansou:   可选规则（订阅后搜索才附带网盘结果）。
-- 幂等：npm_package 唯一键，重复执行只更新 updated_at。
-- author_id 取 admin 账号。

INSERT INTO rules (npm_package, risk_level, description, author_id, status, version, takedown_count, created_at, updated_at)
SELECT '@seekall/rule-greenhub', 'l1', '全网绿色资源聚合搜索：软件/游戏/动漫（底座规则，默认启用）', id, 'published', '0.1.0', 0, NOW(), NOW()
FROM users WHERE username = 'admin'
ON DUPLICATE KEY UPDATE description = VALUES(description), updated_at = NOW();

INSERT INTO rules (npm_package, risk_level, description, author_id, status, version, takedown_count, created_at, updated_at)
SELECT '@seekall/rule-pansou', 'l1', '网盘资源搜索：夸克/阿里云盘/百度（实验性，订阅后生效）', id, 'published', '0.1.0', 0, NOW(), NOW()
FROM users WHERE username = 'admin'
ON DUPLICATE KEY UPDATE description = VALUES(description), updated_at = NOW();
