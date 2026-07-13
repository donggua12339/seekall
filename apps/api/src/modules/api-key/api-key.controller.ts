import { Body, Controller, Get, Post, Delete, Param, ParseIntPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { ApiKeyService } from './api-key.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { IsString, Length } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

class CreateApiKeyDto {
  @ApiProperty({ description: 'API Key 名称（便于识别）' })
  @IsString()
  @Length(1, 64)
  name!: string
}

@ApiTags('API Key')
@ApiBearerAuth()
@Controller('api-keys')
export class ApiKeyController {
  constructor(private readonly service: ApiKeyService) {}

  @Post()
  @ApiOperation({ summary: '生成新 API Key（返回明文，仅此一次）' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateApiKeyDto) {
    return this.service.create(BigInt(userId), dto.name)
  }

  @Get()
  @ApiOperation({ summary: '列出用户所有 API Key（不返回明文）' })
  list(@CurrentUser('sub') userId: string) {
    return this.service.list(BigInt(userId))
  }

  @Delete(':id')
  @ApiOperation({ summary: '撤销 API Key' })
  revoke(@CurrentUser('sub') userId: string, @Param('id', ParseIntPipe) id: number) {
    return this.service.revoke(BigInt(userId), BigInt(id))
  }
}
