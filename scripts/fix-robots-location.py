#!/usr/bin/env python3
"""修复 seekall vhost: 正确插入 robots.txt location(多行)"""
import re

VHOST = '/etc/nginx/sites-enabled/seekall.winmelon.cn'

with open(VHOST, 'r') as f:
    content = f.read()

# 1. 删除之前 sed 插入的失败行(单行注释)
content = re.sub(
    r'\n# robots\.txt（Quick Win #3\)    location = /robots\.txt \{.*?\}\n',
    '\n',
    content,
    flags=re.DOTALL,
)

# 2. 在 "    # API：直接代理到 seekall-api 容器" 之前插入多行 robots location
robots_block = '''    # robots.txt（Quick Win #3）
    location = /robots.txt {
        alias /var/www/seekall/robots.txt;
        access_log off;
        add_header Cache-Control "public, max-age=86400";
    }

'''

if 'location = /robots.txt' not in content:
    content = content.replace(
        '    # API：直接代理到 seekall-api 容器',
        robots_block + '    # API：直接代理到 seekall-api 容器',
    )

with open(VHOST, 'w') as f:
    f.write(content)

print('done')
