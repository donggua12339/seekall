import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { CollectionService } from './collection.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { IsString, IsOptional, IsBoolean, IsInt, Min, Max, Length } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

class CreateCollectionDto {
  @ApiProperty({ description: '合集标题' })
  @IsString()
  @Length(1, 128)
  title!: string
  @ApiProperty({ description: '描述', required: false })
  @IsOptional()
  @IsString()
  description?: string
  @ApiProperty({ description: '封面 URL', required: false })
  @IsOptional()
  @IsString()
  coverUrl?: string
  @ApiProperty({ description: '是否公开', required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean
}

class UpdateCollectionDto {
  @IsOptional() @IsString() @Length(1, 128) title?: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsString() coverUrl?: string
  @IsOptional() @IsBoolean() isPublic?: boolean
}

class AddItemDto {
  @ApiProperty({ description: '资源 URL' })
  @IsString()
  resourceUrl!: string
  @ApiProperty({ description: '资源标题' })
  @IsString()
  title!: string
  @IsOptional() @IsString() source?: string
  @IsOptional() @IsString() fileType?: string
}

class PageDto {
  @IsInt() @Min(1) page: number = 1
  @IsInt() @Min(1) @Max(50) pageSize: number = 20
}

@ApiTags('资源合集')
@ApiBearerAuth()
@Controller('collections')
export class CollectionController {
  constructor(private readonly service: CollectionService) {}

  @Get()
  @ApiOperation({ summary: '我的合集列表' })
  list(@CurrentUser('sub') userId: string, @Query() dto: PageDto) {
    return this.service.list(BigInt(userId), dto.page, dto.pageSize)
  }

  @Post()
  @ApiOperation({ summary: '创建合集' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateCollectionDto) {
    return this.service.create(BigInt(userId), dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新合集' })
  update(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCollectionDto,
  ) {
    return this.service.update(BigInt(userId), BigInt(id), dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除合集' })
  delete(@CurrentUser('sub') userId: string, @Param('id', ParseIntPipe) id: number) {
    return this.service.delete(BigInt(userId), BigInt(id))
  }

  @Get(':id/items')
  @ApiOperation({ summary: '合集内资源列表' })
  listItems(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseIntPipe) id: number,
    @Query() dto: PageDto,
  ) {
    return this.service.listItems(BigInt(userId), BigInt(id), dto.page, dto.pageSize)
  }

  @Post(':id/items')
  @ApiOperation({ summary: '添加资源到合集' })
  addItem(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AddItemDto,
  ) {
    return this.service.addItem(BigInt(userId), BigInt(id), dto)
  }

  @Delete(':id/items/:itemId')
  @ApiOperation({ summary: '从合集移除资源' })
  removeItem(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseIntPipe) id: number,
    @Param('itemId', ParseIntPipe) itemId: number,
  ) {
    return this.service.removeItem(BigInt(userId), BigInt(id), BigInt(itemId))
  }
}
