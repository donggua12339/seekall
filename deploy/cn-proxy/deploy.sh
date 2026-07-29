#!/bin/bash
# SeekAll 大陆代理微服务 - 一键部署脚本
# 在大陆 VPS 上执行：bash deploy.sh
#
# 支持：Ubuntu/Debian/CentOS/Alpine
# 要求：2核2G+ 内存（puppeteer 需要）

set -e

echo "=== SeekAll 大陆代理部署 ==="

# 1. 安装 Chromium
echo "[1/5] 安装 Chromium..."
if command -v apt-get &>/dev/null; then
  apt-get update -qq && apt-get install -y -qq chromium-browser || apt-get install -y -qq chromium
elif command -v yum &>/dev/null; then
  yum install -y chromium
elif command -v apk &>/dev/null; then
  apk add --no-cache chromium
else
  echo "❌ 不支持的包管理器，请手动安装 chromium"
  exit 1
fi

# 2. 安装 Node.js 20+
echo "[2/5] 检查 Node.js..."
if ! command -v node &>/dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 20 ]]; then
  echo "  安装 Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - 2>/dev/null || \
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - 2>/dev/null || true
  apt-get install -y -qq nodejs 2>/dev/null || yum install -y nodejs 2>/dev/null || true
fi
echo "  Node.js $(node -v)"

# 3. 安装 puppeteer-core
echo "[3/5] 安装依赖..."
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
if [ ! -f package.json ]; then
  cat > package.json << 'PKGJSON'
{
  "name": "seekall-cn-proxy",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "dependencies": {
    "puppeteer-core": "^24.0.0"
  }
}
PKGJSON
fi
npm install --production 2>&1 | tail -3

# 4. 创建 systemd 服务
echo "[4/5] 配置 systemd 服务..."
cat > /etc/systemd/system/seekall-cn-proxy.service << SVCEOF
[Unit]
Description=SeekAll CN Proxy (puppeteer pan search)
After=network.target

[Service]
Type=simple
WorkingDirectory=${SCRIPT_DIR}
ExecStart=$(which node) server.mjs
Restart=always
RestartSec=5
Environment=PORT=8787
Environment=PUPPETEER_EXECUTABLE_PATH=$(which chromium-browser 2>/dev/null || which chromium 2>/dev/null || which google-chrome 2>/dev/null)
# 内存限制
MemoryMax=1G

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable seekall-cn-proxy
systemctl restart seekall-cn-proxy

# 5. 验证
echo "[5/5] 验证..."
sleep 3
if curl -s http://localhost:8787/health | grep -q ok; then
  echo ""
  echo "✅ 部署成功！"
  echo ""
  PUBLIC_IP=$(curl -s ifconfig.me 2>/dev/null || curl -s ip.sb 2>/dev/null || echo "<你的公网IP>")
  echo "  服务地址: http://${PUBLIC_IP}:8787"
  echo "  搜索测试: http://${PUBLIC_IP}:8787/search?q=test"
  echo "  健康检查: http://${PUBLIC_IP}:8787/health"
  echo ""
  echo "⚠️  请确保安全组/防火墙放行 8787 端口"
  echo ""
  echo "然后在 SeekAll HK 服务器 .env 加："
  echo "  CN_PANSOU_URL=http://${PUBLIC_IP}:8787"
  echo "  重启 seekall-api 容器即可"
else
  echo "❌ 服务启动失败，查看日志："
  echo "  journalctl -u seekall-cn-proxy -n 20"
fi
