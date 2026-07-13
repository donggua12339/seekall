import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { FastifyReply } from 'fastify'
import { SearchService } from './search.service'
import { ProviderService } from '../provider/provider.service'
import { ApiKeyAuthGuard } from '../api-key/api-key-auth.guard'
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

  @ApiProperty({ description: '网盘类型过滤（如 夸克网盘/百度网盘/磁力）', required: false })
  @IsOptional()
  @IsString()
  fileType?: string

  @ApiProperty({
    description: '排序方式：relevance(默认) / time / size',
    required: false,
    default: 'relevance',
  })
  @IsOptional()
  @IsString()
  sort?: string
}

class SuggestQueryDto {
  @ApiProperty({ description: '输入中的关键词' })
  @IsString()
  keyword!: string

  @ApiProperty({ description: '返回条数', default: 10 })
  @IsInt()
  @Min(1)
  @Max(20)
  limit: number = 10
}

@ApiTags('搜索')
@ApiBearerAuth()
@Controller('search')
export class SearchController {
  constructor(
    private readonly searchService: SearchService,
    private readonly providerService: ProviderService,
  ) {}

  @Public()
  @UseGuards(ApiKeyAuthGuard)
  @Get()
  @ApiOperation({ summary: '实时搜索资源（聚合多 Provider，支持过滤/排序）' })
  search(@Query() dto: SearchQueryDto, @CurrentUser() user?: { sub: string }) {
    return this.searchService.search(
      {
        keyword: dto.keyword,
        page: dto.page,
        pageSize: dto.pageSize,
        category: dto.category,
        fileType: dto.fileType,
        sort: dto.sort,
      },
      user?.sub ? BigInt(user.sub) : null,
    )
  }

  @Public()
  @Get('suggest')
  @ApiOperation({ summary: '搜索建议（热门词 + 用户历史联想）' })
  suggest(@Query() dto: SuggestQueryDto, @CurrentUser() user?: { sub: string }) {
    return this.searchService.suggest(
      dto.keyword,
      dto.limit,
      user?.sub ? BigInt(user.sub) : null,
    )
  }

  @Public()
  @UseGuards(ApiKeyAuthGuard)
  @Get('fuzzy')
  @ApiOperation({ summary: '模糊搜索（本地 Meilisearch 索引，支持拼音/分词/容错）' })
  fuzzy(@Query() dto: SearchQueryDto) {
    return this.searchService.fuzzySearch(dto.keyword, dto.page, dto.pageSize)
  }

  @Public()
  @UseGuards(ApiKeyAuthGuard)
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

  @Public()
  @UseGuards(ApiKeyAuthGuard)
  @Get('stream')
  @ApiOperation({ summary: '流式搜索（SSE，Provider 完成即推送）' })
  async stream(@Query() dto: SearchQueryDto, @Res() reply: FastifyReply) {
    // SSE 响应头
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Nginx/Caddy 禁用缓冲
    })

    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\n`)
      reply.raw.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    if (!dto.keyword?.trim()) {
      send('error', { message: '关键词不能为空' })
      reply.raw.end()
      return
    }

    let totalResults = 0

    send('start', {
      keyword: dto.keyword,
      providers: this.providerService.getActiveProviders().map((p) => p.name),
    })

    const { errors, durationMs } = await this.providerService.streamSearch(
      { keyword: dto.keyword, page: dto.page, pageSize: dto.pageSize },
      (provider, results) => {
        totalResults += results.length
        send('partial', { provider, results, count: results.length })
      },
      (provider, error) => {
        send('provider-error', { provider, error })
      },
    )

    send('complete', { total: totalResults, errors, durationMs })
    reply.raw.end()
  }
}
