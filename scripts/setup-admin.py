#!/usr/bin/env python3
# HK 服务器上执行：在 seekall-api 容器内运行 setup-admin
"""Usage:
  python3 scripts/setup-admin.py <container|local> <username> <email> <password>

Example:
  python3 scripts/setup-admin.py container admin <REDACTED_ADMIN_EMAIL> 'AdminP@ss2026'
"""
import subprocess, sys, re
from pathlib import Path

env_file = Path(__file__).parent.parent / ".env"
mode = sys.argv[1] if len(sys.argv) > 1 else "container"
username = sys.argv[2] if len(sys.argv) > 2 else "admin"
email = sys.argv[3] if len(sys.argv) > 3 else "<REDACTED_ADMIN_EMAIL>"
password = sys.argv[4] if len(sys.argv) > 4 else ""

# 从 .env 提取 DATABASE_URL 转成 docker 内部 URL
DATABASE_URL = None
for line in env_file.read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if line.startswith("DATABASE_URL="):
        DATABASE_URL = line.split("=", 1)[1]
        break

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in .env", file=sys.stderr)
    sys.exit(1)

# docker 模式下，把 localhost 替换为容器网络名
DB_URL_CONTAINER = re.sub(r"localhost|127\.0\.0\.1", "mysql", DATABASE_URL)

if mode == "local":
    # 直接在当前机器跑（需要 Node + 项目 dist）
    print(f"使用 DATABASE_URL: {DATABASE_URL}")
    cmd = ["node", "dist/cli/setup-admin.js", username, email, password]
else:
    print(f"在容器内跑，使用 DB_URL: {DB_URL_CONTAINER}")
    inner = f'DATABASE_URL="{DB_URL_CONTAINER}" node dist/cli/setup-admin.js {username} {email} "{password}"'
    cmd = ["docker", "exec", "-i", "seekall-api", "sh", "-c", inner]

result = subprocess.run(cmd, capture_output=True, text=True)
print("--- STDOUT ---")
print(result.stdout)
if result.stderr:
    print("--- STDERR ---")
    print(result.stderr)
print(f"Exit: {result.returncode}")
