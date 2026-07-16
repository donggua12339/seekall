import {
  Body,
  Controller,
  Get,
  Delete,
  Post,
  Patch,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common'
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
  @IsOptional() collectionId?: string
}

class ListDto {
  @IsInt() @Min(1) page: number = 1
  @IsInt() @Min(1) @Max(100) pageSize: number = 20
  @IsOptional() @IsString() collectionId?: string
}

class CreateCollectionDto {
  @IsString() name!: string
}

class MoveDto {
  @IsOptional() collectionId?: string
}

@ApiTags('收藏夹')
@ApiBearerAuth()
@Controller('favorites')
export class FavoriteController {
  constructor(private readonly service: FavoriteService) {}

  @Get()
  @ApiOperation({ summary: '收藏夹列表（可按分组过滤）' })
  list(@CurrentUser('sub') userId: string, @Query() dto: ListDto) {
    return this.service.list(
      BigInt(userId),
      dto.page,
      dto.pageSize,
      dto.collectionId ? BigInt(dto.collectionId) : undefined,
    )
  }

  @Post()
  @ApiOperation({ summary: '添加收藏（可指定分组）' })
  add(@CurrentUser('sub') userId: string, @Body() dto: AddDto) {
    return this.service.add(BigInt(userId), {
      ...dto,
      collectionId: dto.collectionId ? BigInt(dto.collectionId) : undefined,
    })
  }

  @Delete(':id')
  @ApiOperation({ summary: '取消收藏' })
  delete(@CurrentUser('sub') userId: string, @Param('id', ParseIntPipe) id: number) {
    return this.service.delete(BigInt(userId), BigInt(id))
  }

  @Patch(':id/move')
  @ApiOperation({ summary: '移动收藏到指定分组' })
  move(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MoveDto,
  ) {
    return this.service.moveToCollection(
      BigInt(userId),
      BigInt(id),
      dto.collectionId ? BigInt(dto.collectionId) : null,
    )
  }

  // ====== 收藏夹分组管理 ======

  @Get('collections')
  @ApiOperation({ summary: '收藏夹分组列表' })
  listCollections(@CurrentUser('sub') userId: string) {
    return this.service.listCollections(BigInt(userId))
  }

  @Post('collections')
  @ApiOperation({ summary: '创建收藏夹分组' })
  createCollection(@CurrentUser('sub') userId: string, @Body() dto: CreateCollectionDto) {
    return this.service.createCollection(BigInt(userId), dto.name)
  }

  @Delete('collections/:id')
  @ApiOperation({ summary: '删除收藏夹分组（收藏项移到默认分组）' })
  deleteCollection(@CurrentUser('sub') userId: string, @Param('id', ParseIntPipe) id: number) {
    return this.service.deleteCollection(BigInt(userId), BigInt(id))
  }
}
