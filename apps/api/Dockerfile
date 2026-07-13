# 觅源 SeekAll API - Dockerfile
# 多阶段构建，减小镜像体积

# ====== Stage 1: 构建 ======
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# 复制 package.json 和 lockfile
COPY package.json pnpm-lock.yaml* ./
COPY prisma ./prisma/

# 安装依赖
RUN pnpm install --frozen-lockfile --prod=false

# 生成 Prisma Client
RUN pnpm prisma generate

# 复制源码
COPY . .

# 构建
RUN pnpm build

# ====== Stage 2: 运行 ======
FROM node:20-alpine AS runner

WORKDIR /app

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# 安全：非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001 -G nodejs

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

# 复制迁移文件
COPY prisma ./prisma

USER nestjs

EXPOSE 3000

# 启动前执行迁移，然后启动应用
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
