#!/usr/bin/env python3
# 列出 SeekAll admin 用户（通过 .env 读 DB 凭证）
"""Usage: python show-admin.py"""
import os, sys
from pathlib import Path

env = {}
for line in Path(__file__).parent.parent.joinpath(".env").read_text(encoding="utf-8").splitlines():
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    env[k.strip()] = v.strip()

# connect via docker port-forward
import subprocess
result = subprocess.run(
    ["docker", "exec", "-i", "seekall-mysql",
     "env", f"MYSQL_PWD={env['MYSQL_ROOT_PASSWORD']}",
     "mysql", "-u", "root", "seekall",
     "-N", "-B", "-e", "SELECT id, username, email, role, status FROM users;"],
    capture_output=True, text=True
)
print(result.stdout)
if result.stderr:
    print("ERR:", result.stderr, file=sys.stderr)
