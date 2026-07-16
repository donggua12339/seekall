# 觅源 SeekAll Web - Dockerfile
# 多阶段构建

# ====== Stage 1: 构建 ======
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# 使用 npmmirror（淘宝镜像）提升 tarball 下载速度，HK 服务器到 npmjs.org 偶发超时
RUN pnpm config set registry https://registry.npmmirror.com && \
  # 改用 npm 风格扁平 node_modules，避开 pnpm store 导致的 esbuild binary 版本错配
  pnpm config set node-linker hoisted

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install --no-frozen-lockfile --prod=false --ignore-scripts && \
  pnpm store prune || true && \
  pnpm rebuild esbuild || true

COPY . .

RUN pnpm build

# ====== Stage 2: 运行 ======
FROM node:20-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nuxt -u 1001 -G nodejs

COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules

USER nuxt

EXPOSE 3000

ENV NODE_ENV=production
ENV NUXT_HOST=0.0.0.0
ENV NUXT_PORT=3000

CMD ["node", ".output/server/index.mjs"]
