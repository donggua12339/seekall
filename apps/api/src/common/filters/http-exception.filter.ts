import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { FastifyReply, FastifyRequest } from 'fastify'
import { ErrorCode, getErrorMessage } from '../constants/error-codes'

export class BusinessException extends Error {
  constructor(
    public readonly code: number,
    public readonly statusCode: number = HttpStatus.BAD_REQUEST,
    message?: string,
  ) {
    super(message || getErrorMessage(code))
    this.name = 'BusinessException'
  }
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<FastifyReply>()
    const request = ctx.getRequest<FastifyRequest>()

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR
    let code = ErrorCode.INTERNAL_ERROR
    let message = getErrorMessage(ErrorCode.INTERNAL_ERROR)

    if (exception instanceof BusinessException) {
      statusCode = exception.statusCode
      code = exception.code
      message = exception.message
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus()
      const res = exception.getResponse()
      if (typeof res === 'object' && res !== null && 'message' in res) {
        message = (res as { message: string }).message
        code = statusCode === 401 ? ErrorCode.UNAUTHORIZED : ErrorCode.PARAM_ERROR
      } else if (typeof res === 'string') {
        message = res
        code = ErrorCode.PARAM_ERROR
      }
    } else if (exception instanceof Error) {
      message = exception.message
      this.logger.error(`Unexpected error: ${exception.stack}`)
    }

    // 限流特殊处理
    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      code = ErrorCode.RATE_LIMIT_EXCEEDED
      message = getErrorMessage(ErrorCode.RATE_LIMIT_EXCEEDED)
    }

    if (statusCode >= 500) {
      this.logger.error(
        `${request.method} ${request.url} ${statusCode} - ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      )
    }

    response.status(statusCode).send({
      code,
      data: null,
      message,
    })
  }
}
