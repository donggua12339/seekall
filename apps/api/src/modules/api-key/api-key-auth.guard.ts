import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ApiKeyService } from './api-key.service'
import { BusinessException } from '../../common/filters/http-exception.filter'
import { ErrorCode } from '../../common/constants/error-codes'
import type { FastifyRequest } from 'fastify'

/**
 * API Key 鉴权守卫
 * 支持 JWT 或 API Key 二选一
 * - JWT: Authorization: Bearer <jwt>
 * - API Key: X-API-Key: sk_xxx 或 Authorization: Bearer sk_xxx
 *
 * 用于 API 开放端点（搜索 + 搜索历史）
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const authHeader = (request.headers as Record<string, string>).authorization || ''
    const apiKeyHeader = (request.headers as Record<string, string>)['x-api-key'] || ''

    // 提取 token
    let token = ''
    let isApiKey = false

    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7)
      isApiKey = token.startsWith('sk_')
    } else if (apiKeyHeader.startsWith('sk_')) {
      token = apiKeyHeader
      isApiKey = true
    }

    if (!token) {
      throw new UnauthorizedException('Missing authentication')
    }

    if (isApiKey) {
      // API Key 鉴权
      const result = await this.apiKeyService.validate(token)
      if (!result) {
        throw new BusinessException(ErrorCode.TOKEN_INVALID, 401, 'API Key 无效或已撤销')
      }
      ;(request as unknown as { user: { sub: string; apiKeyId: string } }).user = {
        sub: result.userId.toString(),
        apiKeyId: result.apiKeyId.toString(),
      }
      return true
    }

    // JWT 鉴权
    try {
      const payload = await this.jwtService.verifyAsync(token)
      ;(request as unknown as { user: unknown }).user = payload
      return true
    } catch {
      throw new BusinessException(ErrorCode.TOKEN_INVALID, 401, 'Token 无效或已过期')
    }
  }
}
