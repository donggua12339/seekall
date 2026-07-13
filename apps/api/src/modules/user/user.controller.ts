import { Body, Controller, Get, Patch, Delete, Post, Param } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { UserService } from './user.service'
import { AuthService } from '../auth/auth.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { IsString, IsOptional, IsInt, Min, Max, IsBoolean, IsArray } from 'class-validator'

class UpdateProfileDto {
  @IsOptional() @IsString() avatarUrl?: string
  @IsOptional() @IsString() bio?: string
  @IsOptional() @IsString() theme?: string
  @IsOptional() @IsString() language?: string
  @IsOptional() @IsInt() @Min(10) @Max(50) searchPageSize?: number
  @IsOptional() @IsBoolean() safeSearch?: boolean
  @IsOptional() @IsArray() preferredCategories?: string[]
  @IsOptional() @IsArray() preferredProviders?: string[]
}

class ActivateMembershipDto {
  @IsString() code!: string
}

@ApiTags('用户')
@ApiBearerAuth()
@Controller('user')
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @Get('profile')
  @ApiOperation({ summary: '获取个人信息' })
  getProfile(@CurrentUser('sub') userId: string) {
    return this.userService.getProfile(BigInt(userId))
  }

  @Patch('profile')
  @ApiOperation({ summary: '更新个人信息' })
  updateProfile(@CurrentUser('sub') userId: string, @Body() dto: UpdateProfileDto) {
    return this.userService.updateProfile(BigInt(userId), dto)
  }

  @Delete('account')
  @ApiOperation({ summary: '注销账号（软删除）' })
  deleteAccount(@CurrentUser('sub') userId: string) {
    return this.userService.deleteAccount(BigInt(userId))
  }

  @Post('membership/activate')
  @ApiOperation({ summary: '激活会员' })
  activateMembership(@CurrentUser('sub') userId: string, @Body() dto: ActivateMembershipDto) {
    return this.userService.activateMembership(BigInt(userId), dto.code)
  }

  @Get('sessions')
  @ApiOperation({ summary: '登录设备列表' })
  listSessions(@CurrentUser('sub') userId: string) {
    return this.authService.getSessions(BigInt(userId))
  }

  @Delete('sessions/:id')
  @ApiOperation({ summary: '踢出指定登录设备' })
  revokeSession(@CurrentUser('sub') userId: string, @Param('id') sessionId: string) {
    return this.authService.revokeSession(BigInt(userId), sessionId)
  }
}
