import { registerAs } from '@nestjs/config'

export const appConfig = registerAs('app', () => ({
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  domain: process.env.APP_DOMAIN || 'localhost',
  adminDomain: process.env.ADMIN_DOMAIN || 'localhost',
}))
