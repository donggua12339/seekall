#!/usr/bin/env bash
# 觅源 SeekAll - 本地 → HK 服务器代码同步
# 在 **本地机器**（我这台 Windows 的 Linux 兼容环境）运行
# 推送代码到服务器，跳过大文件/隐私
#
# 用法（在你机器上）：
#   bash rsync-to-hk.sh [target-dir-on-server]
#   默认推到 /opt/seekall/

set -euo pipefail

HOST="${HOST:-root@<REDACTED_SERVER_IP>}"
DEST="${1:-/opt/seekall}"

EXCLUDES=(
  "--exclude=node_modules"
  "--exclude=.nuxt"
  "--exclude=.output"
  "--exclude=dist"
  "--exclude=.nitro"
  "--exclude=.cache"
  "--exclude=.pnpm-store"
  "--exclude=dumps/"
  "--exclude=*.log"
  "--exclude=.git"
  "--exclude=apps/api/api.err.log"
  "--exclude=apps/api/api.out.log"
  "--exclude=nuxt.err.log"
  "--exclude=nuxt.out.log"
  "--exclude=api.err.log"
  "--exclude=api.out.log"
  "--exclude=.env"
  "--exclude=.env.local"
  "--exclude=backup-run.mjs"
)

echo "====== 同步本地代码到 $HOST:$DEST ======"
echo "排除: node_modules, .nuxt, dist, dumps/, *.log, .git, .env 等"
echo ""

# 沿用父目录名
PARENT_DIR="$(dirname "$DEST")"
DEST_NAME="$(basename "$DEST")"

# 先确保服务器目标目录存在
ssh -p 22 "$HOST" "mkdir -p $PARENT_DIR"

# 用 rsync 推整个 seekall 项目目录过去
# 来源是当前脚本所在项目的根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# 注意：ssh 上有些 rsync 不支持，排除 Windows-only 路径模式
rsync -avz --progress \
  "${EXCLUDES[@]}" \
  -e "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null" \
  "$PROJECT_ROOT/" \
  "$HOST:$DEST/"

echo ""
echo "====== 同步完成 ======"
echo "下一步：在服务器上运行"
echo "  ssh $HOST"
echo "  bash scripts/deploy-hk.sh"
