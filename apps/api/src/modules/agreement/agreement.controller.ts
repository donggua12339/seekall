import { Body, Controller, Get, Post } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { AgreementService } from './agreement.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { IsString, IsDateString } from 'class-validator'

class CreateDto {
  @IsString() version!: string
  @IsString() content!: string
  @IsDateString() effectiveDate!: string
}

@ApiTags('用户协议')
@Controller('agreements')
export class AgreementController {
  constructor(private readonly service: AgreementService) {}

  @Public()
  @Get('current')
  @ApiOperation({ summary: '获取当前用户协议' })
  getCurrent() {
    return this.service.getCurrent()
  }

  @ApiBearerAuth()
  @Roles('super_admin')
  @Post()
  @ApiOperation({ summary: '发布新版本用户协议' })
  create(@Body() dto: CreateDto, @CurrentUser('sub') userId: string) {
    return this.service.create(
      {
        version: dto.version,
        content: dto.content,
        effectiveDate: new Date(dto.effectiveDate),
      },
      BigInt(userId),
    )
  }
}
