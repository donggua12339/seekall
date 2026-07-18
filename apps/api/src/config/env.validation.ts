import * as Joi from 'joi'

export const envValidation = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),

  // 数据库
  DATABASE_URL: Joi.string().required(),
  MYSQL_ROOT_PASSWORD: Joi.string().required(),
  MYSQL_DATABASE: Joi.string().required(),
  MYSQL_USER: Joi.string().required(),
  MYSQL_PASSWORD: Joi.string().required(),

  // Redis
  REDIS_URL: Joi.string().required(),

  // Meilisearch
  MEILISEARCH_URL: Joi.string().required(),
  MEILISEARCH_MASTER_KEY: Joi.string().required(),

  // JWT
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_EXPIRES: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES: Joi.string().default('7d'),

  // 邮件
  MAIL_PROVIDER: Joi.string().valid('resend', 'qq').default('resend'),
  MAIL_FROM: Joi.string().required(),
  RESEND_API_KEY: Joi.string().when('MAIL_PROVIDER', {
    is: 'resend',
    then: Joi.required(),
  }),
  QQ_MAIL_USER: Joi.string().when('MAIL_PROVIDER', {
    is: 'qq',
    then: Joi.required(),
  }),
  QQ_MAIL_PASSWORD: Joi.string().when('MAIL_PROVIDER', {
    is: 'qq',
    then: Joi.required(),
  }),

  // 域名
  APP_DOMAIN: Joi.string().required(),
  ADMIN_DOMAIN: Joi.string().required(),

  // 搜索
  SEARCH_GLOBAL_TIMEOUT: Joi.number().default(8000),
  SEARCH_CACHE_TTL: Joi.number().default(3600),
  SEARCH_DEFAULT_PAGE_SIZE: Joi.number().default(20),
  SEARCH_MAX_PAGE_SIZE: Joi.number().default(50),

  // 限流
  RATE_LIMIT_GLOBAL: Joi.number().default(100),
  RATE_LIMIT_SEARCH: Joi.number().default(30),
  RATE_LIMIT_LOGIN: Joi.number().default(5),
  RATE_LIMIT_REGISTER: Joi.number().default(3),

  // 失效链接
  LINK_CHECKER_CONCURRENCY: Joi.number().default(10),
  LINK_CHECKER_TIMEOUT: Joi.number().default(5000),

  // 用户
  USER_SEARCH_HISTORY_FREE: Joi.number().default(50),
  USER_SEARCH_HISTORY_PAID: Joi.number().default(500),

  // Swagger
  SWAGGER_ENABLED: Joi.string().valid('true', 'false').default('true'),

  // 日志
  LOG_LEVEL: Joi.string().valid('debug', 'info', 'warn', 'error').default('info'),

  // DMCA（P2-1 可选，不配则跳过 admin 邮件通知）
  DMCA_ADMIN_EMAIL: Joi.string().email().optional(),
})
