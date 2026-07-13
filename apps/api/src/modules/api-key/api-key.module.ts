import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { ApiKeyService } from './api-key.service'
import { ApiKeyController } from './api-key.controller'
import { ApiKeyAuthGuard } from './api-key-auth.guard'

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_ACCESS_SECRET,
      }),
    }),
  ],
  controllers: [ApiKeyController],
  providers: [ApiKeyService, ApiKeyAuthGuard],
  exports: [ApiKeyService, ApiKeyAuthGuard, JwtModule],
})
export class ApiKeyModule {}
