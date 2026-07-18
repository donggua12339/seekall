import { Module } from '@nestjs/common'
import { DmcaController, AdminDmcaController } from './dmca.controller'
import { DmcaService } from './dmca.service'
import { MailModule } from '../mail/mail.module'

@Module({
  imports: [MailModule],
  controllers: [DmcaController, AdminDmcaController],
  providers: [DmcaService],
  exports: [DmcaService],
})
export class DmcaModule {}
