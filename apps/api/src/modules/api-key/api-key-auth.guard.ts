import {
  Injectable,
  CanActivate,
  ExecutionContext,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { ApiKeyService } from './api-key.service'
import { BusinessException } from '../../common/filters/http-exception.filter'
import { ErrorCode } from '../../common/constants/error-codes'
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator'
import type { FastifyRequest } from 'fastify'

export const API_KEY_SCOPES = 'api_key_scopes'
export const RequireScopes = (...scopes: string[]) => SetMetadata(API_KEY_SCOPES, scopes)

/**
 * API Key 鉴权守卫
 * 支持 JWT 或 API Key 二选一
 * - JWT: Authorization: Bearer <jwt>
 * - API Key: X-API-Key: sk_xxx 或 Authorization: Bearer sk_xxx
 *
 * 支持 scope 权限检查：用 @RequireScopes('search') 装饰接口
 * 公开接口（@Public()）直接放行，无需 token
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly apiKeyService: ApiKeyService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // 公开接口直接放行
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

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

    // 获取接口需要的 scopes
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(API_KEY_SCOPES, [
      context.getHandler(),
      context.getClass(),
    ])

    if (isApiKey) {
      // API Key 鉴权
      const result = await this.apiKeyService.validate(token)
      if (!result) {
        throw new BusinessException(ErrorCode.TOKEN_INVALID, 401, 'API Key 无效或已撤销')
      }

      // scope 权限检查
      if (requiredScopes && requiredScopes.length > 0) {
        const hasScope = requiredScopes.some((s) => result.scopes.includes(s))
        if (!hasScope) {
          throw new BusinessException(
            ErrorCode.FORBIDDEN,
            403,
            `API Key 权限不足，需要: ${requiredScopes.join(' 或 ')}`,
          )
        }
      }

      ;(request as unknown as { user: { sub: string; apiKeyId: string; scopes: string[] } }).user =
        {
          sub: result.userId.toString(),
          apiKeyId: result.apiKeyId.toString(),
          scopes: result.scopes,
        }
      return true
    }

    // JWT 鉴权（JWT 用户拥有全部权限）
    try {
      const payload = await this.jwtService.verifyAsync(token)
      ;(request as unknown as { user: unknown }).user = payload
      return true
    } catch {
      throw new BusinessException(ErrorCode.TOKEN_INVALID, 401, 'Token 无效或已过期')
    }
  }
}
