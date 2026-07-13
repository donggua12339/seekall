import { Body, Controller, Get, Post, Delete, Param, ParseIntPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { CloudAccountService } from './cloud-account.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { IsString, Length, IsOptional, IsIn } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

const VALID_TYPES = ['quark', 'aliyun', 'baidu', 'xunlei', '115']

class AddAccountDto {
  @ApiProperty({ description: '网盘类型', enum: VALID_TYPES })
  @IsString()
  @IsIn(VALID_TYPES)
  type!: string

  @ApiProperty({ description: '网盘 Cookie（从浏览器 F12 复制）' })
  @IsString()
  @Length(10, 10000)
  cookie!: string

  @ApiProperty({ description: '备注', required: false })
  @IsOptional()
  @IsString()
  remark?: string
}

class TransferDto {
  @ApiProperty({ description: '资源链接' })
  @IsString()
  resourceUrl!: string

  @ApiProperty({ description: '目标网盘类型', enum: VALID_TYPES })
  @IsString()
  @IsIn(VALID_TYPES)
  type!: string
}

@ApiTags('网盘账号（转存助手）')
@ApiBearerAuth()
@Controller('cloud-accounts')
export class CloudAccountController {
  constructor(private readonly service: CloudAccountService) {}

  @Get()
  @ApiOperation({ summary: '网盘账号列表' })
  list(@CurrentUser('sub') userId: string) {
    return this.service.list(BigInt(userId))
  }

  @Post()
  @ApiOperation({ summary: '添加/更新网盘账号（Cookie）' })
  add(@CurrentUser('sub') userId: string, @Body() dto: AddAccountDto) {
    return this.service.add(BigInt(userId), dto.type, dto.cookie, dto.remark)
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除网盘账号' })
  remove(@CurrentUser('sub') userId: string, @Param('id', ParseIntPipe) id: number) {
    return this.service.remove(BigInt(userId), BigInt(id))
  }

  @Post('transfer')
  @ApiOperation({ summary: '转存资源到网盘（开发中）' })
  transfer(@CurrentUser('sub') userId: string, @Body() dto: TransferDto) {
    return this.service.transfer(BigInt(userId), dto.resourceUrl, dto.type)
  }
}
