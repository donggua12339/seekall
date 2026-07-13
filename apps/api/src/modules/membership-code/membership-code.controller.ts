import { Body, Controller, Get, Post, Patch, Query, Param, ParseIntPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { MembershipCodeService } from './membership-code.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { IsInt, Min, Max, IsOptional, IsString, IsDateString } from 'class-validator'

class GenerateDto {
  @IsInt() @Min(1) @Max(1000) count!: number
  @IsInt() @Min(1) @Max(3650) durationDays!: number
  @IsOptional() @IsDateString() expiresAt?: string
}

class ListDto {
  @IsInt() @Min(1) page: number = 1
  @IsInt() @Min(1) @Max(100) pageSize: number = 20
  @IsOptional() @IsString() status?: string
}

@ApiTags('会员激活码（管理员）')
@ApiBearerAuth()
@Roles('super_admin')
@Controller('admin/membership-codes')
export class MembershipCodeController {
  constructor(private readonly service: MembershipCodeService) {}

  @Post('generate')
  @ApiOperation({ summary: '批量生成会员激活码' })
  generate(@Body() dto: GenerateDto, @CurrentUser('sub') userId: string) {
    return this.service.generateBatch(
      dto.count,
      dto.durationDays,
      BigInt(userId),
      dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    )
  }

  @Get()
  @ApiOperation({ summary: '会员激活码列表' })
  list(@Query() dto: ListDto) {
    return this.service.list(dto.page, dto.pageSize, dto.status)
  }

  @Patch(':id/disable')
  @ApiOperation({ summary: '禁用会员激活码' })
  disable(@Param('id', ParseIntPipe) id: number) {
    return this.service.disable(BigInt(id))
  }

  @Get('export')
  @ApiOperation({ summary: '导出未使用会员激活码（上架 WM 发卡网）' })
  export(@CurrentUser('sub') userId: string) {
    return this.service.exportUnused(BigInt(userId))
  }
}
