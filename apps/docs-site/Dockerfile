# SeekAll docs-site - vitepress 静态文档站
# 两阶段构建：node 构建 -> nginx 托管静态文件

# ===== Stage 1: build =====
FROM node:20-alpine AS builder

WORKDIR /app

# pnpm
RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# 配置 npmmirror（避开 esbuild binary CDN mismatch）
RUN pnpm config set registry https://registry.npmmirror.com

# 先 copy package.json 装依赖（缓存层）
COPY apps/docs-site/package.json ./
COPY pnpm-workspace.yaml ./

RUN pnpm install --no-frozen-lockfile --ignore-scripts

# copy 源码
COPY apps/docs-site/ ./

# 构建
RUN pnpm build

# ===== Stage 2: serve =====
FROM nginx:alpine

# 删默认配置
RUN rm /etc/nginx/conf.d/default.conf

# copy 静态文件
COPY --from=builder /app/.vitepress/dist /usr/share/nginx/html

# nginx 配置：SPA fallback + 静态资源缓存
COPY apps/docs-site/nginx.conf /etc/nginx/conf.d/docs-site.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
