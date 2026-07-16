import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { SubtitleService } from './subtitle.service'
import { Public } from '../../common/decorators/public.decorator'
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

class SubtitleQueryDto {
  @ApiProperty({ description: '关键词（影视名）' })
  @IsString()
  keyword!: string

  @ApiProperty({ description: '语言', required: false, default: 'zh,en' })
  @IsOptional()
  @IsString()
  language?: string

  @ApiProperty({ description: '返回条数', required: false, default: 10 })
  @IsInt()
  @Min(1)
  @Max(30)
  limit: number = 10
}

@ApiTags('字幕')
@ApiBearerAuth()
@Controller('subtitles')
export class SubtitleController {
  constructor(private readonly service: SubtitleService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: '搜索字幕（OpenSubtitles，需配置 API Key）' })
  search(@Query() dto: SubtitleQueryDto) {
    return this.service.search(dto.keyword, dto.language || 'zh,en', dto.limit)
  }
}
