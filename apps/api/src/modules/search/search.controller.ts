import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { IsString, MinLength, MaxLength, IsOptional, IsIn } from 'class-validator'
import { SearchService } from './search.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'

class SearchQueryDto {
  @IsString()
  @MinLength(1, { message: '搜索关键词不能为空' })
  @MaxLength(100, { message: '搜索关键词过长' })
  q!: string

  /** 是否附加网盘搜索（无头浏览器，较慢）。传 "1" 开启 */
  @IsOptional()
  @IsIn(['0', '1'], { message: 'pansou 只能是 0 或 1' })
  pansou?: string
}

@ApiTags('资源搜索')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: '全网资源聚合搜索（底座 greenhub + 订阅/开关触发的可选规则）' })
  search(@Query() dto: SearchQueryDto, @CurrentUser('sub') userId: string) {
    return this.searchService.search(dto.q, { pansou: dto.pansou === '1' }, BigInt(userId))
  }
}
