import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { IsString, MinLength, MaxLength } from 'class-validator'
import { SearchService } from './search.service'

class SearchQueryDto {
  @IsString()
  @MinLength(1, { message: '搜索关键词不能为空' })
  @MaxLength(100, { message: '搜索关键词过长' })
  q!: string
}

@ApiTags('资源搜索')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: '全网绿色资源聚合搜索（greenhub 规则，11 源并行）' })
  search(@Query() dto: SearchQueryDto) {
    return this.searchService.search(dto.q)
  }
}
