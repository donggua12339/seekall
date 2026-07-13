# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/lang/zh-CN/spec/v2.0.0.html).

## [Unreleased]

### Added

- 项目宪章确立（Z++ 方案）
- 项目骨架搭建完成
  - 后端 NestJS + Fastify + Prisma
  - 前端 Nuxt 3 SSR + Naive UI + Pinia
  - Docker Compose 部署配置
  - Caddy 反向代理 + 自动 HTTPS
  - Prisma schema 设计
  - Provider 插件框架
  - 邀请码 + 会员激活码系统
  - 完整合规框架（takedown / 关键词黑名单 / 用户协议）
  - 失效链接检测（BullMQ 定时任务）
  - 邮件服务（Resend + QQ SMTP）

## [0.1.0] - TBD

### 计划功能（MVP）

- 用户系统（注册/登录/邮箱验证/密码重置）
- 后台管理（用户列表/邀请码生成/审计日志）
- 邀请码注册控制
- 会员激活码（非功能性特权：徽章 + 搜索历史容量扩大）
- 搜索聚合（PanSou API + 1 个磁力站 + 1 个单网盘）
- 搜索历史 + 收藏夹
- 失效链接检测
- 完整合规框架
- Swagger API 文档
