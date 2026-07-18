# SeekAll docs-site - vitepress 静态文档站
# 两阶段构建：node 构建 -> nginx 托管静态文件

# ===== Stage 1: build =====
FROM node:20-alpine AS builder

WORKDIR /app

# pnpm + git（vitepress build 需要 git 计算 lastUpdated）
RUN apk add --no-cache git && \
  npm install -g pnpm@9.0.0 --registry=https://registry.npmmirror.com

# 先 copy package.json 装依赖（缓存层）
COPY package.json ./

RUN pnpm install --no-frozen-lockfile --ignore-scripts

# copy 源码
COPY . .

# 构建
RUN pnpm build

# ===== Stage 2: serve =====
FROM nginx:alpine

# 删默认配置
RUN rm /etc/nginx/conf.d/default.conf

# copy 静态文件
COPY --from=builder /app/.vitepress/dist /usr/share/nginx/html

# nginx 配置：SPA fallback + 静态资源缓存
COPY nginx.conf /etc/nginx/conf.d/docs-site.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
