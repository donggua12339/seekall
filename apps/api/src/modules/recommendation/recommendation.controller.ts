import { Controller, Get, Query } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { RecommendationService } from './recommendation.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { IsInt, Min, Max } from 'class-validator'

class RecommendDto {
  @IsInt() @Min(1) @Max(50) limit: number = 10
}

@ApiTags('推荐')
@ApiBearerAuth()
@Controller('recommendations')
export class RecommendationController {
  constructor(private readonly service: RecommendationService) {}

  @Get()
  @ApiOperation({ summary: '基于搜索历史的个性化推荐' })
  recommend(@CurrentUser('sub') userId: string, @Query() dto: RecommendDto) {
    return this.service.recommendForUser(BigInt(userId), dto.limit)
  }
}
