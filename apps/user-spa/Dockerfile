# SeekAll User SPA - 两阶段构建
# Stage 1: build static files
FROM node:20-alpine AS builder

WORKDIR /app

# 安装 pnpm + 国内镜像(Alpine 镜像构建加速)
# 2026-08-04: corepack prepare 从 npmjs 拉 pnpm 网络不稳导致 build 失败,
# 对齐 API 已验证的 npm install -g 写法(直连 npmmirror,绕过 corepack 下载)
RUN npm install -g pnpm@9.0.0 --registry=https://registry.npmmirror.com \
  && npm config set registry https://registry.npmmirror.com \
  && pnpm config set registry https://registry.npmmirror.com

# 先拷 workspace 配置和依赖清单(利用 docker 缓存)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/user-spa/package.json ./apps/user-spa/

# 安装 user-spa 依赖(--filter 避免安装其他 workspace)
RUN pnpm install --filter @seekall/user-spa... --frozen-lock-file=false || pnpm install --filter @seekall/user-spa... --no-frozen-lockfile

# 拷贝源代码
COPY apps/user-spa/ ./apps/user-spa/

# 构建(VITE_API_BASE_URL 留空,prod 用 nginx 反代到 /api)
ENV NODE_ENV=production
RUN cd apps/user-spa && pnpm run build

# Stage 2: nginx serve static
FROM nginx:alpine

# 删默认配置(避免 default.conf 抢占 80 端口,导致 SPA fallback 不生效)
RUN rm /etc/nginx/conf.d/default.conf

# 替换默认配置
COPY apps/user-spa/nginx.conf /etc/nginx/conf.d/user-spa.conf
COPY --from=builder /app/apps/user-spa/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1
