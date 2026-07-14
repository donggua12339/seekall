import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { IsString, IsOptional, MaxLength, IsBoolean } from 'class-validator'
import { SubscriptionService } from './subscription.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'

class CreateSubscriptionDto {
  @IsString() @MaxLength(100) keyword!: string
  @IsOptional() @IsBoolean() notifyEmail?: boolean
}

@ApiTags('关键词订阅')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly service: SubscriptionService) {}

  @Get()
  @ApiOperation({ summary: '我的订阅列表' })
  list(@CurrentUser('sub') userId: string) {
    return this.service.list(BigInt(userId))
  }

  @Post()
  @ApiOperation({ summary: '订阅关键词（有新资源时邮件通知）' })
  create(@CurrentUser('sub') userId: string, @Body() dto: CreateSubscriptionDto) {
    return this.service.create(BigInt(userId), dto.keyword, dto.notifyEmail ?? true)
  }

  @Delete(':id')
  @ApiOperation({ summary: '取消订阅' })
  delete(@CurrentUser('sub') userId: string, @Param('id', ParseIntPipe) id: number) {
    return this.service.delete(BigInt(userId), BigInt(id))
  }
}
