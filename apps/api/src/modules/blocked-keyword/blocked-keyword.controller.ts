import { Body, Controller, Get, Post, Delete, Query, Param, ParseIntPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { BlockedKeywordService } from './blocked-keyword.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { IsString, IsOptional, IsInt, Min, Max } from 'class-validator'

class AddDto {
  @IsString() keyword!: string
  @IsOptional() @IsString() category?: string
}

class ListDto {
  @IsInt() @Min(1) page: number = 1
  @IsInt() @Min(1) @Max(100) pageSize: number = 20
}

@ApiTags('关键词黑名单（管理员）')
@ApiBearerAuth()
@Roles('super_admin')
@Controller('admin/blocked-keywords')
export class BlockedKeywordController {
  constructor(private readonly service: BlockedKeywordService) {}

  @Get()
  @ApiOperation({ summary: '黑名单列表' })
  list(@Query() dto: ListDto) {
    return this.service.list(dto.page, dto.pageSize)
  }

  @Post()
  @ApiOperation({ summary: '添加黑名单关键词' })
  add(@Body() dto: AddDto, @CurrentUser('sub') userId: string) {
    return this.service.add(dto.keyword, dto.category, BigInt(userId))
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除黑名单关键词' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(BigInt(id))
  }
}
