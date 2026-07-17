import { Body, Controller, Get, Patch, Delete, Param } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { UserService } from './user.service'
import { AuthService } from '../auth/auth.service'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { IsString, IsOptional } from 'class-validator'

class UpdateProfileDto {
  @IsOptional() @IsString() avatarUrl?: string
  @IsOptional() @IsString() bio?: string
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
