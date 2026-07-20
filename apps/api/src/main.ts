import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import { ValidationPipe, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import fastifyCookie from '@fastify/cookie'
import fastifyHelmet from '@fastify/helmet'
import * as Sentry from '@sentry/node'
import { nodeProfilingIntegration } from '@sentry/profiling-node'
import { AppModule } from './app.module'
import { HttpExceptionFilter } from './common/filters/http-exception.filter'
import { ResponseInterceptor } from './common/interceptors/response.interceptor'

// BigInt 序列化支持（Prisma 返回 BigInt，JSON.stringify 默认不支持）
;(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return (this as unknown as bigint).toString()
}

async function bootstrap() {
  const logger = new Logger('Bootstrap')

  // Sentry 初始化（DSN 为空时跳过）
  const sentryDsn = process.env.SENTRY_DSN
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.APP_VERSION || '0.1.0',
      integrations: [nodeProfilingIntegration()],
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
      profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE || 0.1),
    })
    logger.log('Sentry initialized')
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true, bodyLimit: 1024 * 1024 * 2 }),
  )

  const configService = app.get(ConfigService)

  // 全局前缀
  app.setGlobalPrefix('api/v1')

  // CORS
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGINS', '').split(',').filter(Boolean),
    credentials: true,
  })

  // Fastify 插件
  await app.register(fastifyCookie as never, {
    secret: configService.get<string>('JWT_REFRESH_SECRET'),
  })
  // Helmet CSP：必须显式声明 connect-src，否则 EventSource 跨端口/跨域会被浏览器静默阻止
  // - dev: 允许 localhost:7301（API 端口）
  // - prod: 允许主域名 + 当前 origin
  // - 'self' 已包含同源；额外白名单用于 SSE 直连场景
  await app.register(fastifyHelmet as never, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        fontSrc: ["'self'", 'https:', 'data:'],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
        // SSE / fetch / XHR 允许的目标：同源 + 开发 API 端口 + 生产主域
        connectSrc: [
          "'self'",
          'http://localhost:7301',
          'https://seekall.winmelon.cn',
          'https://admin.seekall.winmelon.cn',
          ...(configService.get<string>('NODE_ENV') === 'development'
            ? ['ws:', 'http://localhost:*', 'http://127.0.0.1:*']
            : []),
        ],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  })

  // 全局管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // 全局过滤器 & 拦截器
  app.useGlobalFilters(new HttpExceptionFilter())
  app.useGlobalInterceptors(new ResponseInterceptor())

  // Swagger（仅 dev/staging，生产环境强制关闭）
  if (
    configService.get<string>('NODE_ENV') !== 'production' &&
    configService.get<string>('SWAGGER_ENABLED', 'true') === 'true'
  ) {
    const config = new DocumentBuilder()
      .setTitle('SeekAll API')
      .setDescription('觅源 SeekAll - 全网资源聚合搜索引擎 API 文档')
      .setVersion('0.1.0')
      .setLicense('AGPL-3.0', 'https://www.gnu.org/licenses/agpl-3.0.html')
      .addBearerAuth()
      .build()
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('docs', app, document)
    logger.log('Swagger docs available at /docs')
  }

  // 启动
  const port = configService.get<number>('APP_PORT', 7301)
  await app.listen(port, '0.0.0.0')
  logger.log(`SeekAll API running on port ${port}`)
}

bootstrap()
