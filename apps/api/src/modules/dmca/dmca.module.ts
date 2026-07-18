import { Module } from '@nestjs/common'
import { DmcaController, AdminDmcaController } from './dmca.controller'
import { DmcaService } from './dmca.service'

@Module({
  controllers: [DmcaController, AdminDmcaController],
  providers: [DmcaService],
  exports: [DmcaService],
})
export class DmcaModule {}
