import { Body, Controller, Get, Post, Patch, Query, Param, ParseIntPipe } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { TakedownService } from './takedown.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { IsEmail, IsString, IsInt, Min, Max, IsOptional, IsIn } from 'class-validator'

class ReportDto {
  @IsEmail() reporterEmail!: string
  @IsString() resourceUrl!: string
  @IsString() reason!: string
}

class ListDto {
  @IsInt() @Min(1) page: number = 1
  @IsInt() @Min(1) @Max(100) pageSize: number = 20
  @IsOptional() @IsString() status?: string
}

class ResolveDto {
  @IsIn(['resolved', 'rejected']) status!: 'resolved' | 'rejected'
}

@ApiTags('侵权举报 / Takedown')
@Controller('takedown')
export class TakedownController {
  constructor(private readonly service: TakedownService) {}

  @Public()
  @Post('report')
  @ApiOperation({ summary: '提交侵权举报（公开接口）' })
  report(@Body() dto: ReportDto) {
    return this.service.report(dto)
  }

  @ApiBearerAuth()
  @Roles('super_admin')
  @Get()
  @ApiOperation({ summary: '举报列表（管理员）' })
  list(@Query() dto: ListDto) {
    return this.service.list(dto.page, dto.pageSize, dto.status)
  }

  @ApiBearerAuth()
  @Roles('super_admin')
  @Patch(':id/resolve')
  @ApiOperation({ summary: '处理举报（管理员）' })
  resolve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.service.resolve(BigInt(id), BigInt(userId), dto.status)
  }
}
