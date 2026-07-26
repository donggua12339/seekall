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
COPY packages/rule-greenhub/package.json ./packages/rule-greenhub/

# prisma generate 需要 schema，先拷过来
COPY apps/api/prisma ./apps/api/prisma/

# ── 安装依赖 ──
# --filter @seekall/api... 只装 api 及其 workspace 依赖链（greenhub -> sdk）+ 外部依赖（cheerio 等），
#   不装其它无关 workspace（admin/docs/其它 rule），省时省空间
# --no-frozen-lockfile：根 lockfile 与 workspace 结构 reconcile
# --prod=false：装 devDeps（nest cli / tsup / typescript），构建需要
# --ignore-scripts：跳过 esbuild postinstall 的 binary 校验（CDN 偶发版本错配），下面显式 rebuild
RUN pnpm install --filter @seekall/api... --no-frozen-lockfile --prod=false --ignore-scripts && \
  # 清空 pnpm store 强制 esbuild 重新下载匹配版本的 binary（避免 store 残留版本错配）
  pnpm store prune || true && \
  # 显式重建 esbuild（拉匹配的 binary）
  pnpm rebuild esbuild || true

# ── 生成 Prisma Client ──
# 用 node 直接调 prisma build/index.js，避免 pnpm 9.0.0 在 alpine + hoisted 模式下
# `pnpm exec prisma` 报 "Command prisma not found" 的 bug
# schema 在 apps/api/prisma/，需显式 --schema 指向
RUN node node_modules/prisma/build/index.js generate --schema=apps/api/prisma/schema.prisma

# ── 拷贝源码 ──
COPY apps/api/ ./apps/api/
COPY packages/sdk/ ./packages/sdk/
COPY packages/rule-greenhub/ ./packages/rule-greenhub/

# ── 构建 ──
# 先 build greenhub（连带 sdk，topo 顺序）产出运行时 dist，再 build api
# greenhub 的 dist 会在运行时被 api 通过动态 import 加载
RUN pnpm --filter @seekall/rule-greenhub... build && \
  pnpm --filter @seekall/api build

# ====== Stage 2: 运行 ======
FROM node:20-alpine AS runner

WORKDIR /app

# Alpine 用 musl libc，Prisma 引擎 binary 需要 glibc → 必须装 openssl
RUN apk add --no-cache openssl

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
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node dist/main.js"]
