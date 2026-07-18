# 觅源 SeekAll API - Dockerfile
# 多阶段构建，减小镜像体积

# ====== Stage 1: 构建 ======
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm（直接 npm install -g，绕过 corepack 网络下载超时）
RUN npm install -g pnpm@9.0.0 --registry=https://registry.npmmirror.com

# 使用 npmmirror（淘宝镜像）提升 tarball 下载速度，HK 服务器到 npmjs.org 偶发超时
RUN pnpm config set registry https://registry.npmmirror.com && \
  # 改用 npm 风格扁平 node_modules，避开 pnpm store 导致的 esbuild binary 版本错配
  pnpm config set node-linker hoisted

# 复制 package.json 和 lockfile
COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma/

# 安装依赖
# monorepo 根 pnpm-lock.yaml 不在 build context 内（compose context=apps/api/），
# 用 --no-frozen-lockfile 让 pnpm 自行 resolve；CI/CD 阶段建议改成 root context + --frozen-lockfile
# --ignore-scripts 跳过 esbuild postinstall 的 binary 校验（CDN 偶发版本错配），esbuild binary 会在 build 时按需下载
RUN pnpm install --no-frozen-lockfile --prod=false --ignore-scripts && \
  # 清空 pnpm store 强制 esbuild 重新下载匹配版本的 binary（避免 store 残留版本错配）
  pnpm store prune || true && \
  # 显式重建 esbuild（拉匹配的 binary）
  pnpm rebuild esbuild || true

# 生成 Prisma Client
RUN pnpm prisma generate

# 复制源码
COPY . .

# 构建
RUN pnpm build

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
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nestjs:nodejs /app/package.json ./

# 复制迁移文件
COPY --chown=nestjs:nodejs prisma ./prisma

USER nestjs

EXPOSE 3000

# 启动前同步 schema 到数据库（migrations 目录不全，用 db push 补齐）
# --accept-data-loss 允许删除 0_init 中残留的失败索引；首次部署用，后续迁移应改用 migrate deploy
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node dist/main.js"]
