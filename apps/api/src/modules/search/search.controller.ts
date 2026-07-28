import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { IsString, MinLength, MaxLength } from 'class-validator'
import { SearchService } from './search.service'
import { Public } from '../../common/decorators/public.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'

class SearchQueryDto {
  @IsString()
  @MinLength(1, { message: '搜索关键词不能为空' })
  @MaxLength(100, { message: '搜索关键词过长' })
  q!: string
}

@ApiTags('资源搜索')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: '全网资源聚合搜索（免登录，登录后自动加载订阅规则）' })
  search(@Query() dto: SearchQueryDto, @CurrentUser('sub') userId?: string) {
    return this.searchService.search(dto.q, {}, userId ? BigInt(userId) : undefined)
  }
}
