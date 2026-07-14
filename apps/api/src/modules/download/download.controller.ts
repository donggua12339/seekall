import { Body, Controller, Get, Post, Delete, Param } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { DownloadService } from './download.service'
import { IsString } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

class AddMagnetDto {
  @ApiProperty({ description: '磁力链接' })
  @IsString()
  magnet!: string
}

@ApiTags('下载队列')
@ApiBearerAuth()
@Controller('download')
export class DownloadController {
  constructor(private readonly service: DownloadService) {}

  @Post('magnet')
  @ApiOperation({ summary: '添加磁力链接到 aria2 下载队列' })
  addMagnet(@Body() dto: AddMagnetDto) {
    return this.service.addMagnet(dto.magnet)
  }

  @Get('active')
  @ApiOperation({ summary: '获取活跃下载列表' })
  listActive() {
    return this.service.listActive()
  }

  @Get(':gid')
  @ApiOperation({ summary: '查询下载状态' })
  getStatus(@Param('gid') gid: string) {
    return this.service.getStatus(gid)
  }

  @Post(':gid/pause')
  @ApiOperation({ summary: '暂停下载' })
  pause(@Param('gid') gid: string) {
    return this.service.pause(gid)
  }

  @Delete(':gid')
  @ApiOperation({ summary: '删除下载任务' })
  remove(@Param('gid') gid: string) {
    return this.service.remove(gid)
  }
}
