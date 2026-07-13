import { Module } from '@nestjs/common'
import { SearchController } from './search.controller'
import { SearchService } from './search.service'
import { ProviderModule } from '../provider/provider.module'
import { ApiKeyModule } from '../api-key/api-key.module'

@Module({
  imports: [ProviderModule, ApiKeyModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
