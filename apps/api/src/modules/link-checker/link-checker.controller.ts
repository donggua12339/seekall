import { Controller, Post, Body, Get, Query, Inject } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { LinkCheckerService } from './link-checker.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { Public } from '../../common/decorators/public.decorator'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { REDIS_CLIENT } from '../../database/redis.module'
import { IsString, IsInt, IsOptional, Min, IsIn } from 'class-validator'
import { createHash } from 'crypto'
import type Redis from 'ioredis'

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

class VoteDto {
  @IsString() url!: string
  @IsIn(['up', 'down']) vote!: 'up' | 'down'
}

@ApiTags('失效链接检测')
@Controller('link-checker')
export class LinkCheckerController {
  constructor(
    private readonly service: LinkCheckerService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

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
  @Post('vote')
  @ApiOperation({ summary: '资源有效性投票（有效/失效）' })
  async vote(
    @Body() dto: VoteDto,
    @CurrentUser('sub') userId?: string,
  ) {
    const urlHash = createHash('md5').update(dto.url).digest('hex')
    const key = `votes:${urlHash}`

    await this.redis.hincrby(key, dto.vote, 1)
    await this.redis.expire(key, 90 * 24 * 60 * 60)

    if (userId) {
      const userKey = `user-vote:${userId}:${urlHash}`
      await this.redis.set(userKey, dto.vote, 'EX', 90 * 24 * 60 * 60)
    }

    const [up, down] = await this.redis.hmget(key, 'up', 'down')
    return {
      url: dto.url,
      vote: dto.vote,
      up: Number(up) || 0,
      down: Number(down) || 0,
    }
  }

  @Public()
  @Get('votes')
  @ApiOperation({ summary: '查询链接投票数' })
  async getVotes(@Query() dto: StatusDto) {
    const urlHash = createHash('md5').update(dto.url).digest('hex')
    const key = `votes:${urlHash}`
    const [up, down] = await this.redis.hmget(key, 'up', 'down')
    return {
      url: dto.url,
      up: Number(up) || 0,
      down: Number(down) || 0,
    }
  }

  @ApiBearerAuth()
  @Roles('super_admin')
  @Post('batch-check')
  @ApiOperation({ summary: '触发批量检测（管理员）' })
  batchCheck(@Body() dto: BatchCheckDto) {
    return this.service.scheduleBatchCheck(dto.days ?? 7, dto.limit ?? 1000)
  }
}
