import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { FastifyRequest } from 'fastify'
import { IS_PUBLIC_KEY } from '../decorators/public.decorator'
import { ErrorCode } from '../constants/error-codes'
import { BusinessException } from '../filters/http-exception.filter'

export interface JwtPayload {
  sub: string
  username: string
  role: string
  isPaid: boolean
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const token = this.extractToken(request)
    if (!token) {
      throw new UnauthorizedException()
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(token)
      ;(request as unknown as { user: JwtPayload }).user = payload
    } catch {
      throw new BusinessException(ErrorCode.TOKEN_INVALID, 401)
    }

    // 角色校验
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ])
    if (
      requiredRoles &&
      !requiredRoles.includes((request as unknown as { user: JwtPayload }).user.role)
    ) {
      throw new BusinessException(ErrorCode.FORBIDDEN, 403)
    }

    return true
  }

  private extractToken(request: FastifyRequest): string | undefined {
    const authHeader = request.headers.authorization
    if (!authHeader) return undefined
    const [type, token] = authHeader.split(' ')
    return type === 'Bearer' ? token : undefined
  }
}
