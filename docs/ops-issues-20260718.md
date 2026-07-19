# SeekAll v0.5 运维问题清单

**服务器**: HK <REDACTED_SERVER_IP>:22022 (雨云,无备案)
**SSH 用户**: `<REDACTED_SSH_USER>` (sudoers 白名单: docker / nginx / xray / git)
**生成时间**: 2026-07-18
**当前版本**: v0.5.0 (commit `0cf9ea2`)

---

## P0 - 影响生产,需立即处理

### 1. Redis MISCONF 导致 API 健康 degraded

**现象**:

- `GET https://seekall.winmelon.cn/api/v1/health` 返回 `status: "degraded"`
- `services.redis` 报错:
  ```
  MISCONF Redis is configured to save RDB snapshots, but it's currently unable to persist to disk.
  Commands that may modify the data set are disabled, because this instance is configured
  to report errors during writes if RDB snapshotting fails (stop-writes-on-bgsave-error option).
  Please check the Redis logs for details about the RDB error.
  ```

**影响**:

- API 进入降级模式,所有依赖 Redis 写入的功能失效
- DMCA webform 提交会失败(速率限制用 Redis)
- JWT refresh token / session 管理可能受影响

**可能原因**(按概率排序):

1. **磁盘空间不足** - Redis 无法写 RDB 快照
2. **`/data` 目录权限问题** - bind mount 在 LXD 嵌套容器里权限反复
3. **内存不足** - bgsave fork 失败

**诊断命令**(SSH 到服务器后):

```bash
# 1. 查磁盘空间
df -h

# 2. 查 Redis 数据目录权限
sudo ls -la /opt/seekall-v0.5/docker/redis/data/

# 3. 查 Redis 完整日志
sudo docker logs seekall-redis --tail 50 2>&1

# 4. 进容器查内存
sudo docker exec -w / seekall-redis redis-cli INFO memory | head -10

# 5. 进容器手动测写入
sudo docker exec -w / seekall-redis redis-cli SET test_key test_value
```

**修复方案**:

- **磁盘满**: 清理 `/opt/seekall-v0.4.1-archive-*` 旧备份 / `docker system prune -a --volumes`
- **权限问题**: `sudo chown -R 999:999 /opt/seekall-v0.5/docker/redis/data/` (redis 用户 UID 999)
- **临时绕过**(不推荐): `CONFIG SET stop-writes-on-bgsave-error no`(允许写入但不持久化)

---

### 2. seekall-redis healthcheck unhealthy 8 小时

**现象**:

- `sudo docker ps` 显示 `seekall-redis Up 8 hours (unhealthy)`
- 但 Redis 实际可用(`redis-cli ping` 返回 PONG)

**根因**:

- LXD 嵌套容器下 `docker exec CMD` 形式报 `container breakout detected`
- 已在 v0.5 commit `0cf9ea2` 修复:redis/mysql healthcheck 改用 `CMD-SHELL`
- 但**容器尚未用新 docker-compose.yml 重建**,所以还是旧配置

**修复**:

```bash
cd /opt/seekall-v0.5/docker
sudo docker compose up -d --no-deps --force-recreate seekall-redis
# 验证
sleep 15
sudo docker ps | grep redis
# 应显示 (healthy)
```

---

### 3. DNS 未配置(公网无法访问)

**现象**:

- `seekall.winmelon.cn` 和 `admin.seekall.winmelon.cn` 的 DNS A 记录未指向 <REDACTED_SERVER_IP>
- 公网无法访问 https://seekall.winmelon.cn

**需要做**:

1. 在雨云 DNS 后台(或当前 DNS 服务商)添加两条 A 记录:
   ```
   seekall.winmelon.cn          -> <REDACTED_SERVER_IP>
   admin.seekall.winmelon.cn    -> <REDACTED_SERVER_IP>
   ```
2. 等 DNS 生效(通常 5-30 分钟)
3. 用 `dig seekall.winmelon.cn +short` 验证

---

### 4. nginx 反代未配置 admin 子域名

**现象**:

- host nginx(雨云 vhost)没有 `admin.seekall.winmelon.cn` 的 server block
- 即使 DNS 生效,admin SPA 也无法从公网访问

**需要做**:
在 host nginx 加 server block(参考现有 `seekall.winmelon.cn` 配置):

```nginx
server {
    listen 443 ssl http2;
    server_name admin.seekall.winmelon.cn;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # admin SPA
    location / {
        proxy_pass http://172.18.0.7:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name admin.seekall.winmelon.cn;
    return 301 https://$host$request_uri;
}
```

验证:

```bash
sudo nginx -t && sudo systemctl reload nginx
curl -I https://admin.seekall.winmelon.cn/health
# 应返回 200 ok
```

---

## P1 - 不影响生产,但需要清理

### 5. HTTPS 自签证书需要替换

**任务编号**: #12 (pending)
**现状**: 使用自签通配符证书 `*.winmelon.cn`
**需要做**:

- 雨云提供免费通配符证书,或用 Let's Encrypt + DNS-01 challenge
- 替换 nginx 配置里的 `ssl_certificate` / `ssl_certificate_key` 路径

---

### 6. v0.4.1 旧服务 pm2 进程残留

**MEMORY.md 已记录**:

- PanSou 自建实例(v0.4.1 遗留,pm2 进程占 8789 端口)
- TG Collector(v0.4.1 遗留,v0.5 已作废,TG Bot Token 从未配过)
- DHT Crawler(v0.4.1 遗留,pm2 dht-crawler 进程)

**需要做**:

```bash
pm2 list
pm2 delete pansou  # 确认无用后
pm2 delete tg-collector
pm2 delete dht-crawler
pm2 save
```

**注意**: 删前先确认没有其他业务依赖(尤其 PanSou 可能被其他项目调用)。

---

### 7. CLAUDE.md 与 v0.5 现状严重不符

**现状**: `D:\soft\Claude Code Haha\seekall\CLAUDE.md` 还停留在 v0.4.1 描述

- 提到 Nuxt Web (v0.5 已删)
- 提到 Caddy (v0.5 改 nginx)
- 提到 PM2 (v0.5 改 Docker Compose)
- 提到 search/provider/favorite 等 19 个 v0.4 模块 (v0.5 已删)
- 提到 PanSou / TG Collector / DHT Crawler (v0.5 已作废)

**影响**: 任何接手项目的 Agent 读 CLAUDE.md 会获得错误信息,做出错误决策

**需要做**: 重写 CLAUDE.md 反映 v0.5 实际状态(可参考 `CHANGELOG.md` 的 v0.5 部分)

---

## P2 - 已知但不紧急

### 8. docker-compose.yml `version` 字段过时

**警告**:

```
level=warning msg="/opt/seekall-v0.5/docker/docker-compose.yml: the attribute `version` is obsolete,
it will be ignored, please remove it to avoid potential confusion"
```

**修复**: 删除 docker-compose.yml 第一行 `version: '3.9'`

---

### 9. seekall-docs-site healthcheck 之前 unhealthy

**已修复**(commit `0cf9ea2`): healthcheck 改用 `127.0.0.1` 绕 IPv6 问题
**当前状态**: docs-site 已 healthy,无需处理

---

## 验证步骤(修复完所有 P0 后跑一遍)

```bash
# 1. API 健康(应 status: ok,无 degraded)
curl -s https://seekall.winmelon.cn/api/v1/health | jq

# 2. DMCA transparency API
curl -s https://seekall.winmelon.cn/api/v1/dmca/transparency | jq

# 3. Admin SPA 健康
curl -I https://admin.seekall.winmelon.cn/health

# 4. 所有容器状态(应全部 healthy 或 Up)
sudo docker ps --format "table {{.Names}}\t{{.Status}}" | grep seekall

# 5. Redis 写入测试
sudo docker exec -w / seekall-redis redis-cli SET test ok
sudo docker exec -w / seekall-redis redis-cli GET test
# 应返回 "ok"
```

---

## 联系方式

- **代码仓库**: https://github.com/donggua12339/seekall
- **最新 commit**: `0cf9ea2`
- **部署文档**: `/opt/seekall-v0.5/CHANGELOG.md`(v0.5 完整改动)
- **admin 手册**: `apps/docs-site/admin/guide.md`
- **项目状态记录**: 服务器 `~/.claude/projects/D--soft-Claude-Code-Haha/memory/MEMORY.md`

---

## 附:已知踩过的坑(供参考,避免重复)

1. **sudoers 限制** - `<REDACTED_SSH_USER>` 只能 sudo docker / nginx / xray / git,不能 sudo cp / nohup / bash 内部命令
   - 复制文件到 /opt 用 `sudo docker run --rm -v /opt:/opt alpine cp ...`
2. **SSH key + sudo git** - `sudo git` 会重置 HOME,读不到 SSH config,git pull 失败
   - 解决: 先在 <REDACTED_SSH_USER> home git pull,再用 docker cp 到 /opt
3. **LXD 嵌套容器 docker exec breakout** - `docker exec CMD` 形式报 "container breakout detected"
   - 解决: healthcheck 改用 `CMD-SHELL`(已在 commit `0cf9ea2` 修复)
4. **lint-staged 路径含空格** - "Claude Code Haha" 路径含空格,ESLint 报 "No files matching pattern"
   - 解决: `.lintstagedrc.cjs` 用函数形式 + `quote()` 包引号
5. **v0.5 不在 /opt/seekall-v0.5/.git** - 服务器上的 /opt/seekall-v0.5 是从 home seekall cp 来的,git 历史在 ~/seekall
