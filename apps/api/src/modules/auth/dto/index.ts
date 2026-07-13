import { IsString, MinLength, MaxLength, Matches, IsEmail } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class RegisterDto {
  @ApiProperty({ description: '邀请码（8 位）', example: 'K7M2P9XQ' })
  @IsString()
  @Matches(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/, {
    message: '邀请码格式无效',
  })
  inviteCode!: string

  @ApiProperty({ description: '用户名', example: 'seeker' })
  @IsString()
  @MinLength(3)
  @MaxLength(32)
  @Matches(/^[a-zA-Z0-9_]+$/, { message: '用户名只能包含字母、数字、下划线' })
  username!: string

  @ApiProperty({ description: '邮箱', example: 'user@example.com' })
  @IsEmail()
  email!: string

  @ApiProperty({ description: '密码（至少 8 位，含字母和数字）', example: 'password123' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  password!: string

  @ApiProperty({ description: '用户协议版本', example: '1.0.0' })
  @IsString()
  agreementVersion!: string
}

export class LoginDto {
  @ApiProperty({ description: '用户名', example: 'seeker' })
  @IsString()
  username!: string

  @ApiProperty({ description: '密码', example: 'password123' })
  @IsString()
  password!: string
}

export class VerifyEmailDto {
  @ApiProperty({ description: '邮箱验证 token' })
  @IsString()
  token!: string
}

export class RequestPasswordResetDto {
  @ApiProperty({ description: '邮箱', example: 'user@example.com' })
  @IsEmail()
  email!: string
}

export class ResetPasswordDto {
  @ApiProperty({ description: '密码重置 token' })
  @IsString()
  token!: string

  @ApiProperty({ description: '新密码', example: 'newpassword123' })
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  newPassword!: string
}

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh Token' })
  @IsString()
  refreshToken!: string
}
