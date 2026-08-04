import { Module } from '@nestjs/common'
import { SearchController } from './search.controller'
import { SearchService } from './search.service'
import { ResourcesModule } from '../resources/resources.module'

@Module({
  imports: [ResourcesModule],
  controllers: [SearchController],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
