import { Body, Controller, Get, Post, Patch, Query, Param, ParseIntPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { InviteCodeService } from './invite-code.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { IsInt, Min, Max, IsOptional, IsString, IsDateString } from 'class-validator'

class GenerateDto {
  @IsInt() @Min(1) @Max(1000) count!: number
  @IsOptional() @IsDateString() expiresAt?: string
}

class ListDto {
  @IsInt() @Min(1) page: number = 1
  @IsInt() @Min(1) @Max(100) pageSize: number = 20
  @IsOptional() @IsString() status?: string
}

@ApiTags('邀请码（管理员）')
@ApiBearerAuth()
@Roles('super_admin')
@Controller('admin/invite-codes')
export class InviteCodeController {
  constructor(private readonly inviteCodeService: InviteCodeService) {}

  @Post('generate')
  @ApiOperation({ summary: '批量生成邀请码' })
  generate(@Body() dto: GenerateDto, @CurrentUser('sub') userId: string) {
    return this.inviteCodeService.generateBatch(
      dto.count,
      BigInt(userId),
      dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    )
  }

  @Get()
  @ApiOperation({ summary: '邀请码列表' })
  list(@Query() dto: ListDto) {
    return this.inviteCodeService.list(dto.page, dto.pageSize, dto.status)
  }

  @Patch(':id/disable')
  @ApiOperation({ summary: '禁用邀请码' })
  disable(@Param('id', ParseIntPipe) id: number) {
    return this.inviteCodeService.disable(BigInt(id))
  }

  @Get('export')
  @ApiOperation({ summary: '导出未使用邀请码（CSV 上架 WM 发卡网）' })
  export(@CurrentUser('sub') userId: string) {
    return this.inviteCodeService.exportUnused(BigInt(userId))
  }
}
