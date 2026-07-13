import { Controller, Post, Body, Get, Query } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { LinkCheckerService } from './link-checker.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { IsString, IsInt, IsOptional, Min } from 'class-validator'

class ReportDeadDto {
  @IsString() url!: string
}

class StatusDto {
  @IsString() url!: string
}

class BatchCheckDto {
  @IsOptional() @IsInt() @Min(1) days?: number
  @IsOptional() @IsInt() @Min(1) limit?: number
}

@ApiTags('失效链接检测')
@Controller('link-checker')
export class LinkCheckerController {
  constructor(private readonly service: LinkCheckerService) {}

  @Public()
  @Post('report-dead')
  @ApiOperation({ summary: '举报链接失效（公开）' })
  reportDead(@Body() dto: ReportDeadDto) {
    return this.service.reportDead(dto.url)
  }

  @Public()
  @Get('status')
  @ApiOperation({ summary: '查询链接状态' })
  status(@Query() dto: StatusDto) {
    return this.service.getStatus(dto.url)
  }

  @ApiBearerAuth()
  @Roles('super_admin')
  @Post('batch-check')
  @ApiOperation({ summary: '触发批量检测（管理员）' })
  batchCheck(@Body() dto: BatchCheckDto) {
    return this.service.scheduleBatchCheck(dto.days ?? 7, dto.limit ?? 1000)
  }
}
