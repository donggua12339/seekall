import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { ErrorCode } from '../constants/error-codes'

export interface ApiResponse<T> {
  code: number
  data: T | null
  message: string
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((data) => ({
        code: ErrorCode.SUCCESS,
        data: data ?? null,
        message: 'ok',
      })),
    )
  }
}
