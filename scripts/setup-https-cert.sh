#!/bin/bash
# 觅源 SeekAll - HTTPS 真证书部署脚本（Cloudflare Origin Cert）
#
# 前置条件：
#   1. DNS 已解析 seekall.winmelon.cn → <REDACTED_SERVER_IP>
#   2. Cloudflare 后台已启用 SSL/TLS → Full (Strict) 模式
#   3. 已从 Cloudflare Origin Certificate 创建证书（15年有效期）
#      → Cloudflare 控制台 → SSL/TLS → Origin Server → Create Certificate
#
# 用法：
#   1. 上传证书到服务器：
#      scp -P 22022 origin.pem root@<REDACTED_SERVER_IP>:/etc/nginx/ssl/winmelon.cn.crt.new
#      scp -P 22022 origin-key.pem root@<REDACTED_SERVER_IP>:/etc/nginx/ssl/winmelon.cn.key.new
#   2. 在服务器上执行此脚本：
#      bash /tmp/setup-https-cert.sh

set -e

CERT_DIR="/etc/nginx/ssl"
BACKUP_DIR="/etc/nginx/ssl/backup-$(date +%Y%m%d-%H%M%S)"

echo "====== SeekAll HTTPS 真证书部署 ======"
echo "证书目录: $CERT_DIR"
echo ""

# 1. 备份现有自签证书
if [ -f "$CERT_DIR/winmelon.cn.crt" ]; then
  mkdir -p "$BACKUP_DIR"
  cp "$CERT_DIR/winmelon.cn.crt" "$BACKUP_DIR/"
  cp "$CERT_DIR/winmelon.cn.key" "$BACKUP_DIR/"
  echo "✓ 已备份自签证书到 $BACKUP_DIR"
fi

# 2. 检查新证书
if [ ! -f "$CERT_DIR/winmelon.cn.crt.new" ] || [ ! -f "$CERT_DIR/winmelon.cn.key.new" ]; then
  echo "❌ 需要新证书文件:"
  echo "   $CERT_DIR/winmelon.cn.crt.new"
  echo "   $CERT_DIR/winmelon.cn.key.new"
  echo "请先用 scp 上传"
  exit 1
fi

# 3. 验证新证书
echo ""
echo "新证书信息:"
openssl x509 -in "$CERT_DIR/winmelon.cn.crt.new" -noout -subject -dates 2>&1
echo ""
echo "SAN 列表:"
openssl x509 -in "$CERT_DIR/winmelon.cn.crt.new" -noout -text 2>&1 | grep -A 2 "Subject Alternative Name"

# 4. 替换
mv "$CERT_DIR/winmelon.cn.crt.new" "$CERT_DIR/winmelon.cn.crt"
mv "$CERT_DIR/winmelon.cn.key.new" "$CERT_DIR/winmelon.cn.key"
chmod 644 "$CERT_DIR/winmelon.cn.crt"
chmod 600 "$CERT_DIR/winmelon.cn.key"
echo ""
echo "✓ 证书替换完成"

# 5. 测试 nginx 配置
nginx -t 2>&1
echo ""
echo "✓ nginx 配置 OK"

# 6. reload
nginx -s reload 2>&1
echo "✓ nginx reloaded"

# 7. 验证
echo ""
echo "外部 HTTPS 验证："
sleep 2
curl -skS -m 8 -o /dev/null -w "HTTP %{http_code} | ssl_verify=%{ssl_verify_result}\n" "https://seekall.winmelon.cn/api/v1/health"

echo ""
echo "====== 完成 ======"
echo "回滚（如需）："
echo "  mv $BACKUP_DIR/winmelon.cn.crt $CERT_DIR/"
echo "  mv $BACKUP_DIR/winmelon.cn.key $CERT_DIR/"
echo "  nginx -s reload"