import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { IsOptional, IsInt, Min, Max, IsIn, IsString } from 'class-validator'
import { Type } from 'class-transformer'
import { ResourcesService, type TimeRange } from './resources.service'
import { Public } from '../../common/decorators/public.decorator'

class BoardQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit 必须是整数' })
  @Min(1, { message: 'limit 最小 1' })
  @Max(50, { message: 'limit 最大 50' })
  limit?: number

  @IsOptional()
  @IsIn(['today', 'week', 'month', 'year', 'all'], { message: 'range 取值非法' })
  range?: string

  @IsOptional()
  @IsString()
  @IsIn(['pan', 'software', 'game', 'anime', 'all'], { message: 'category 取值非法' })
  category?: string
}

@ApiTags('资源榜单')
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  @Public()
  @Get('hot')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: '热门资源榜（按命中次数，免登录，支持 range/category）' })
  hot(@Query() dto: BoardQueryDto) {
    return this.resources.hot(dto.limit || 50, dto.range as TimeRange | undefined, dto.category)
  }

  @Public()
  @Get('latest')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: '最新入库资源（按首次发现时间，免登录，支持 range/category）' })
  latest(@Query() dto: BoardQueryDto) {
    return this.resources.latest(dto.limit || 50, dto.range as TimeRange | undefined, dto.category)
  }
}
