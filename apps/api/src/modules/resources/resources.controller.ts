import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { IsOptional, IsInt, Min, Max } from 'class-validator'
import { Type } from 'class-transformer'
import { ResourcesService } from './resources.service'
import { Public } from '../../common/decorators/public.decorator'

class LimitDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit 必须是整数' })
  @Min(1, { message: 'limit 最小 1' })
  @Max(50, { message: 'limit 最大 50' })
  limit?: number
}

@ApiTags('资源榜单')
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Public()
  @Get('hot')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: '热门资源榜（按命中次数，免登录）' })
  hot(@Query() dto: LimitDto) {
    return this.resources.hot(dto.limit || 50)
  }

  @Public()
  @Get('latest')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: '最新入库资源（按首次发现时间，免登录）' })
  latest(@Query() dto: LimitDto) {
    return this.resources.latest(dto.limit || 50)
  }
}
