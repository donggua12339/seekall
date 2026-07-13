import { Controller, Get, Delete, Param, ParseIntPipe, Query } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { SearchHistoryService } from './search-history.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { IsInt, Min, Max } from 'class-validator'

class ListDto {
  @IsInt() @Min(1) page: number = 1
  @IsInt() @Min(1) @Max(100) pageSize: number = 20
}

@ApiTags('搜索历史')
@ApiBearerAuth()
@Controller('search-history')
export class SearchHistoryController {
  constructor(private readonly service: SearchHistoryService) {}

  @Get()
  @ApiOperation({ summary: '搜索历史列表（免费 50 条 / 付费 500 条）' })
  list(@CurrentUser('sub') userId: string, @Query() dto: ListDto) {
    return this.service.list(BigInt(userId), dto.page, dto.pageSize)
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除一条搜索历史' })
  delete(@CurrentUser('sub') userId: string, @Param('id', ParseIntPipe) id: number) {
    return this.service.delete(BigInt(userId), BigInt(id))
  }

  @Delete()
  @ApiOperation({ summary: '清空搜索历史' })
  clearAll(@CurrentUser('sub') userId: string) {
    return this.service.clearAll(BigInt(userId))
  }
}
