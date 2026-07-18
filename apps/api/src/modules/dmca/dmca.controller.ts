import { Body, Controller, Get, Param, Post, Query, ParseIntPipe, Req, Ip } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { FastifyRequest } from 'fastify'
import { DmcaService } from './dmca.service'
import { Public } from '../../common/decorators/public.decorator'
import { Roles } from '../../common/decorators/roles.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import {
  IsString,
  IsInt,
  IsOptional,
  IsBoolean,
  IsEmail,
  IsIn,
  Min,
  Max,
  MaxLength,
} from 'class-validator'

class SubmitDmcaDto {
  @IsString()
  @MaxLength(500)
  infringingUrl!: string

  @IsOptional()
  @IsInt()
  @Min(1)
  ruleId?: number

  @IsString()
  @MaxLength(255)
  originalTitle!: string

  @IsString()
  @MaxLength(255)
  copyrightOwner!: string

  @IsEmail()
  reporterEmail!: string

  @IsIn(['owner', 'agent'])
  reporterRole!: 'owner' | 'agent'

  @IsBoolean()
  goodFaithStatement!: boolean

  @IsBoolean()
  accuracyStatement!: boolean

  @IsString()
  @MaxLength(128)
  electronicSignature!: string

  @IsOptional()
  @IsString()
  notes?: string
}

class ListDmcaDto {
  @IsInt() @Min(1) page: number = 1
  @IsInt() @Min(1) @Max(100) pageSize: number = 20
  @IsOptional()
  @IsIn(['pending', 'verified', 'actioned', 'rejected'])
  status?: 'pending' | 'verified' | 'actioned' | 'rejected'
}

class HandleDmcaDto {
  @IsIn(['verify', 'action', 'reject'])
  action!: 'verify' | 'action' | 'reject'

  @IsString()
  @MaxLength(500)
  note!: string
}

@ApiTags('DMCA 版权投诉')
@Controller('dmca')
export class DmcaController {
  constructor(private readonly service: DmcaService) {}

  @Public()
  @Post('notice')
  @ApiOperation({ summary: '提交 DMCA Takedown Notice（公众匿名，每 IP 3次/小时）' })
  submit(@Body() dto: SubmitDmcaDto, @Ip() ip: string, @Req() req: FastifyRequest) {
    // trustProxy 已开启，取 X-Forwarded-For 首段
    const xff = req.headers['x-forwarded-for']
    const clientIp = (typeof xff === 'string' ? xff.split(',')[0]?.trim() : undefined) || ip
    return this.service.submit(
      {
        infringingUrl: dto.infringingUrl,
        ruleId: dto.ruleId,
        originalTitle: dto.originalTitle,
        copyrightOwner: dto.copyrightOwner,
        reporterEmail: dto.reporterEmail,
        reporterRole: dto.reporterRole,
        goodFaithStatement: dto.goodFaithStatement,
        accuracyStatement: dto.accuracyStatement,
        electronicSignature: dto.electronicSignature,
        notes: dto.notes,
      },
      clientIp,
    )
  }

  @Public()
  @Get('transparency')
  @ApiOperation({ summary: '透明度报告：默认上月，可传 ?yearMonth=YYYY-MM 查任意月' })
  transparency(@Query('yearMonth') yearMonth?: string) {
    return this.service.transparencyReport(yearMonth)
  }

  @Public()
  @Get('transparency/history')
  @ApiOperation({ summary: '历史月度透明度报告列表' })
  history() {
    return this.service.listHistoricalReports()
  }

  @Public()
  @Get('transparency/:yearMonth')
  @ApiOperation({ summary: '查指定月份透明度报告（从 configs 表读持久化结果）' })
  historicalReport(@Param('yearMonth') yearMonth: string) {
    return this.service.getHistoricalReport(yearMonth)
  }
}

@ApiTags('后台管理 - DMCA（super_admin）')
@ApiBearerAuth()
@Roles('super_admin')
@Controller('admin/dmca')
export class AdminDmcaController {
  constructor(private readonly service: DmcaService) {}

  @Get()
  @ApiOperation({ summary: 'DMCA 举报列表（分页 + status 过滤）' })
  list(@Query() dto: ListDmcaDto) {
    return this.service.list({
      page: dto.page,
      pageSize: dto.pageSize,
      status: dto.status,
    })
  }

  @Get(':id')
  @ApiOperation({ summary: 'DMCA 举报详情' })
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.get(BigInt(id))
  }

  @Post(':id/handle')
  @ApiOperation({ summary: '处理 DMCA 举报（verify / action / reject）' })
  handle(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: HandleDmcaDto,
    @CurrentUser('sub') adminId: string,
  ) {
    return this.service.handle(BigInt(id), BigInt(adminId), dto.action, dto.note)
  }
}
