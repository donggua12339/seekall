import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { SearchService } from './search.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

class SearchQueryDto {
  @ApiProperty({ description: '关键词' })
  @IsString()
  keyword!: string

  @ApiProperty({ description: '页码', default: 1 })
  @IsInt()
  @Min(1)
  page: number = 1

  @ApiProperty({ description: '每页条数', default: 20 })
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize: number = 20

  @ApiProperty({ description: '资源分类', required: false })
  @IsOptional()
  @IsString()
  category?: string
}

@ApiTags('搜索')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: '实时搜索资源（聚合多 Provider）' })
  search(@Query() dto: SearchQueryDto, @CurrentUser() user?: { sub: string }) {
    return this.searchService.search(
      {
        keyword: dto.keyword,
        page: dto.page,
        pageSize: dto.pageSize,
        category: dto.category,
      },
      user?.sub ? BigInt(user.sub) : null,
    )
  }

  @Public()
  @Get('fuzzy')
  @ApiOperation({ summary: '模糊搜索（本地 Meilisearch 索引，支持拼音/分词/容错）' })
  fuzzy(@Query() dto: SearchQueryDto) {
    return this.searchService.fuzzySearch(dto.keyword, dto.page, dto.pageSize)
  }

  @Public()
  @Get('combined')
  @ApiOperation({ summary: '组合搜索（实时 + 模糊索引合并去重）' })
  async combined(@Query() dto: SearchQueryDto, @CurrentUser() user?: { sub: string }) {
    const [live, fuzzy] = await Promise.all([
      this.searchService.search(
        {
          keyword: dto.keyword,
          page: dto.page,
          pageSize: dto.pageSize,
          category: dto.category,
        },
        user?.sub ? BigInt(user.sub) : null,
      ),
      this.searchService.fuzzySearch(dto.keyword, dto.page, dto.pageSize).catch(() => null),
    ])

    // 合并去重（实时结果优先）
    const seen = new Set<string>()
    const list = [...live.list]
    for (const item of list) {
      seen.add(item.url)
    }
    if (fuzzy) {
      for (const item of fuzzy.list) {
        if (!seen.has(item.url)) {
          list.push(item)
          seen.add(item.url)
        }
      }
    }

    return {
      ...live,
      list,
      total: list.length,
      totalPages: Math.ceil(list.length / dto.pageSize),
      fromIndex: fuzzy !== null,
    }
  }
}
