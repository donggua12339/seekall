# SeekAll Admin SPA - 两阶段构建
# Stage 1: build static files
FROM node:20-alpine AS builder

WORKDIR /app

# 启用 pnpm + 国内镜像（Alpine 镜像构建加速）
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate \
  && npm config set registry https://registry.npmmirror.com

# 先拷 workspace 配置和依赖清单（利用 docker 缓存）
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/admin/package.json ./apps/admin/

# 安装 admin 依赖（--filter 避免安装其他 workspace）
RUN pnpm install --filter @seekall/admin... --frozen-lockfile=false

# 拷贝源代码
COPY apps/admin/ ./apps/admin/

# 构建（VITE_API_BASE_URL 留空，prod 用 nginx 反代到 /api）
ENV NODE_ENV=production
RUN cd apps/admin && pnpm run build

# Stage 2: nginx serve static
FROM nginx:alpine

# 替换默认配置
COPY apps/admin/nginx.conf /etc/nginx/conf.d/admin.conf
COPY --from=builder /app/apps/admin/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1
