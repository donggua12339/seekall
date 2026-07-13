# 觅源 SeekAll 部署文档

> Z++ 小圈子方案 - 裸机部署（Ubuntu/Debian + PM2 + Caddy）

## 前置要求

- Linux 服务器（Ubuntu 20.04+ / Debian 11+）
- 2C4G + 40GB SSD 最低
- root 或 sudo 权限
- 域名已解析到服务器 IP

## 一、系统依赖安装

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装基础工具
sudo apt install -y curl git build-essential

# 安装 Node.js 20（通过 nvm）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20

# 安装 pnpm
npm install -g pnpm@9

# 安装 PM2
npm install -g pm2

# 安装 Caddy（官方源）
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

## 二、数据库服务安装

### MySQL 8

```bash
sudo apt install -y mysql-server

# 安全初始化
sudo mysql_secure_installation

# 创建数据库和用户
sudo mysql << 'EOF'
CREATE DATABASE seekall CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'seekall'@'localhost' IDENTIFIED BY '你的强密码';
GRANT ALL PRIVILEGES ON seekall.* TO 'seekall'@'localhost';
FLUSH PRIVILEGES;
EOF
```

### Redis

```bash
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### Meilisearch

```bash
# 下载二进制
curl -L https://github.com/meilisearch/meilisearch/releases/download/v1.6.0/meilisearch-linux-amd64 -o /usr/local/bin/meilisearch
chmod +x /usr/local/bin/meilisearch

# 创建 systemd 服务
sudo tee /etc/systemd/system/meilisearch.service << 'EOF'
[Unit]
Description=Meilisearch
After=network.target

[Service]
Type=simple
User=www-data
ExecStart=/usr/local/bin/meilisearch --master-key 你的MASTER_KEY --db-path /var/lib/meilisearch/data
Environment=MEILI_ENV=production
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo mkdir -p /var/lib/meilisearch/data
sudo chown -R www-data:www-data /var/lib/meilisearch
sudo systemctl enable meilisearch
sudo systemctl start meilisearch
```

## 三、项目部署

```bash
# 克隆代码
cd /opt
git clone https://github.com/donggua12339/seekall.git
cd seekall

# 配置环境变量
cp .env.production .env
nano .env  # 填写实际密码和密钥

# 生成强随机密钥（填入 .env）
openssl rand -hex 32  # JWT_ACCESS_SECRET
openssl rand -hex 32  # JWT_REFRESH_SECRET
openssl rand -hex 32  # MEILISEARCH_MASTER_KEY

# 一键部署
chmod +x deploy.sh
./deploy.sh

# 首次部署：创建管理员 + 初始化协议
pnpm --filter api cli:setup-admin admin <REDACTED_ADMIN_EMAIL> 你的密码
pnpm --filter api prisma:seed
```

## 四、Caddy 配置

```bash
# 复制生产 Caddyfile
sudo cp docker/caddy/Caddyfile.prod /etc/caddy/Caddyfile

# 重载 Caddy（自动申请 HTTPS 证书）
sudo systemctl reload caddy

# 验证
curl https://seekall.winmelon.cn/api/v1/health
```

## 五、PM2 开机自启

```bash
pm2 startup
pm2 save
```

## 六、备份配置

```bash
# 赋予执行权限
chmod +x backup.sh

# 添加 crontab（每天 3:00 备份）
crontab -e
# 添加：
0 3 * * * /opt/seekall/backup.sh >> /var/log/seekall/backup.log 2>&1
```

## 七、防火墙配置

```bash
# 仅开放必要端口
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable

# 内部服务仅 localhost 访问（MySQL/Redis/Meilisearch/前后端）
```

## 八、验证清单

- [ ] `https://seekall.winmelon.cn` 可访问
- [ ] `https://seekall.winmelon.cn/api/v1/health` 返回 ok
- [ ] `https://admin.seekall.winmelon.cn` 可访问后台
- [ ] PM2 进程正常：`pm2 status`
- [ ] 备份脚本可手动执行：`./backup.sh`
- [ ] Sentry 收到错误上报（触发一个 500 错误测试）
- [ ] UptimeRobot 监控已添加

## 九、常用运维命令

```bash
# 查看日志
pm2 logs seekall-api
pm2 logs seekall-web

# 重启服务
pm2 restart seekall-api
pm2 restart seekall-web

# 更新部署
cd /opt/seekall
git pull
./deploy.sh

# 查看数据库
mysql -u seekall -p seekall

# 查看 Redis
redis-cli

# 查看 Caddy 状态
sudo systemctl status caddy
```

## 十、故障排查

### 服务无法启动
```bash
pm2 logs seekall-api --lines 50
```

### 数据库连接失败
```bash
sudo systemctl status mysql
mysql -u seekall -p -e "SELECT 1"
```

### HTTPS 证书问题
```bash
sudo systemctl status caddy
sudo journalctl -u caddy --no-pager | tail -20
```

### 健康检查失败
```bash
curl http://localhost:7301/api/v1/health
pm2 logs seekall-api --lines 20
```
