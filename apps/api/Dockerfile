# 觅源 SeekAll API - Dockerfile
# 多阶段构建。构建上下文 = 仓库根（与 admin/user-spa 一致），
# 以便解析 workspace 依赖 @seekall/rule-greenhub（绿色资源聚合搜索规则）。

# ====== Stage 1: 构建 ======
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm（直接 npm install -g，绕过 corepack 网络下载超时）
RUN npm install -g pnpm@9.0.0 --registry=https://registry.npmmirror.com

# 使用 npmmirror（淘宝镜像）提升 tarball 下载速度，HK 服务器到 npmjs.org 偶发超时
RUN pnpm config set registry https://registry.npmmirror.com && \
  # 改用 npm 风格扁平 node_modules，避开 pnpm store 导致的 esbuild binary 版本错配
  pnpm config set node-linker hoisted

# ── 依赖清单（利用 docker 缓存）──
# 先拷 workspace 配置 + 各包 package.json，再 install
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages/sdk/package.json ./packages/sdk/
COPY packages/proxy-pool/package.json ./packages/proxy-pool/
COPY packages/rule-greenhub/package.json ./packages/rule-greenhub/
COPY packages/rule-pansou/package.json ./packages/rule-pansou/

# prisma generate 需要 schema，先拷过来
COPY apps/api/prisma ./apps/api/prisma/

# ── 安装依赖 ──
# 全量 workspace 安装（不带 --filter）：--filter + hoisted linker 会导致 @prisma/engines
#   等传递依赖未被正确提升，prisma generate 报 "Cannot find module '@prisma/engines'"。
#   lockfile 已锁定全部依赖，全量安装稳定可控。
# --no-frozen-lockfile：根 lockfile 与 workspace 结构 reconcile
# --prod=false：装 devDeps（nest cli / tsup / typescript / prisma），构建需要
# --ignore-scripts：跳过 esbuild postinstall 的 binary 校验（CDN 偶发版本错配），下面显式 rebuild
# 2026-08-04 事故根因：旧写法 `install && prune || true && rebuild || true` 的
# shell 优先级会把 install 失败吞掉（install 挂了层照样"成功"且无 node_modules，缓存成毒层）。
# 现改为 install 失败必须炸层；prune/rebuild 的容错用子 shell 括号限定范围。
RUN pnpm install --no-frozen-lockfile --prod=false --ignore-scripts && \
  (pnpm store prune || true) && \
  (pnpm rebuild esbuild || true) && \
  test -f node_modules/.modules.yaml && \
  echo INSTALL_LAYOUT_OK

# ── 生成 Prisma Client ──
# 2026-08-04 事故：hoisted install 后 node_modules/prisma 可能缺失，
# 旧 fallback `npx --yes prisma` 会拉最新 prisma 7.x，其 schema 校验不兼容 5.x 的
# `url = env(...)` 写法导致 build 失败。现改为：多路径探测 + 缺则显式装锁定版本 5.22.0。
RUN set -ex; \
  echo "== diag: node_modules 布局 =="; \
  ls node_modules | wc -l; \
  ls node_modules/.bin 2>/dev/null | grep -E "^(prisma|nest|tsup|tsc)$" || echo "NO_ROOT_BINS"; \
  ls apps/api/node_modules 2>/dev/null | head -20 || echo "NO_API_NODE_MODULES"; \
  echo "== prisma generate =="; \
  if [ -f node_modules/prisma/build/index.js ]; then \
    node node_modules/prisma/build/index.js generate --schema=apps/api/prisma/schema.prisma; \
  elif [ -f apps/api/node_modules/prisma/build/index.js ]; then \
    node apps/api/node_modules/prisma/build/index.js generate --schema=apps/api/prisma/schema.prisma; \
  else \
    echo "prisma CLI 缺失，显式安装锁定版本 5.22.0 到 workspace 根"; \
    pnpm add -w -D prisma@5.22.0 --ignore-scripts; \
    node node_modules/prisma/build/index.js generate --schema=apps/api/prisma/schema.prisma; \
  fi

# ── 拷贝源码 ──
COPY apps/api/ ./apps/api/
COPY packages/sdk/ ./packages/sdk/
COPY packages/proxy-pool/ ./packages/proxy-pool/
COPY packages/rule-greenhub/ ./packages/rule-greenhub/
COPY packages/rule-pansou/ ./packages/rule-pansou/

# ── 构建 ──
# 先 build greenhub + pansou（各连带 sdk，topo 顺序）产出运行时 dist，再 build api
# 它们的 dist 会在运行时被 api 通过动态 import 加载
# 最后把构建好的两个规则包显式拷进 node_modules/@seekall/：
#   它们未发布到 npm，pnpm 在部分 workspace + 全量 lockfile 下不会自动链接，
#   运行时会报 "Cannot find package"。拷成真实目录最稳。
RUN pnpm --filter @seekall/rule-greenhub... build && \
  pnpm --filter @seekall/rule-pansou... build && \
  pnpm --filter @seekall/api build && \
  mkdir -p node_modules/@seekall && \
  rm -rf node_modules/@seekall/rule-greenhub node_modules/@seekall/rule-pansou node_modules/@seekall/proxy-pool && \
  cp -r packages/proxy-pool node_modules/@seekall/proxy-pool && \
  cp -r packages/rule-greenhub node_modules/@seekall/rule-greenhub && \
  cp -r packages/rule-pansou node_modules/@seekall/rule-pansou

# ====== Stage 2: 运行 ======
FROM node:20-alpine AS runner

WORKDIR /app

# Alpine 用 musl libc，Prisma 引擎 binary 需要 glibc → 必须装 openssl
# chromium + 字体/图形库：rule-pansou 用无头浏览器渲染 CSR 网盘搜索站
RUN apk add --no-cache openssl chromium nss freetype ttf-freefont
# puppeteer-core 用系统 chromium（不自带浏览器）
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 安装 pnpm（直接 npm install -g，绕过 corepack 网络下载超时）
RUN npm install -g pnpm@9.0.0 --registry=https://registry.npmmirror.com

# 安全：非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# 复制构建产物（--chown 让 nestjs 用户有写权限，prisma migrate 需要写 @prisma/engines）
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
# workspace 包（node_modules/@seekall/* 是指向这里的 symlink，运行时需要；含 greenhub 的 dist）
COPY --from=builder --chown=nestjs:nodejs /app/packages ./packages
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/package.json ./package.json

USER nestjs

EXPOSE 3000

# 启动前同步 schema 到数据库（migrations 目录不全，用 db push 补齐）
# --accept-data-loss 允许删除 0_init 中残留的失败索引；首次部署用，后续迁移应改用 migrate deploy
# 注意：绝不用裸 `npx prisma`——本地缺 CLI 时它会拉 prisma 7.x，schema 校验不兼容直接启动失败。
# 优先用 node_modules 里的锁定版本，兜底也必须带 @5.22.0 版本号。
CMD ["sh", "-c", "(node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss || npx --yes prisma@5.22.0 db push --skip-generate --accept-data-loss) && node dist/main.js"]
