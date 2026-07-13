import { Body, Controller, Get, Delete, Post, Param, ParseIntPipe, Query } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { FavoriteService } from './favorite.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { IsInt, Min, Max, IsString, IsOptional } from 'class-validator'

class AddDto {
  @IsString() resourceUrl!: string
  @IsString() title!: string
  @IsString() source!: string
  @IsOptional() @IsString() category?: string
  @IsOptional() resourceMeta?: unknown
}

class ListDto {
  @IsInt() @Min(1) page: number = 1
  @IsInt() @Min(1) @Max(100) pageSize: number = 20
}

@ApiTags('收藏夹')
@ApiBearerAuth()
@Controller('favorites')
export class FavoriteController {
  constructor(private readonly service: FavoriteService) {}

  @Get()
  @ApiOperation({ summary: '收藏夹列表' })
  list(@CurrentUser('sub') userId: string, @Query() dto: ListDto) {
    return this.service.list(BigInt(userId), dto.page, dto.pageSize)
  }

  @Post()
  @ApiOperation({ summary: '添加收藏' })
  add(@CurrentUser('sub') userId: string, @Body() dto: AddDto) {
    return this.service.add(BigInt(userId), dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: '取消收藏' })
  delete(@CurrentUser('sub') userId: string, @Param('id', ParseIntPipe) id: number) {
    return this.service.delete(BigInt(userId), BigInt(id))
  }
}
