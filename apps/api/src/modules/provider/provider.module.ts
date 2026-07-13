import { Module } from '@nestjs/common'
import { ProviderService } from './provider.service'
import { PansouProvider } from './providers/pansou/pansou.provider'
import { MagnetProvider } from './providers/magnet/magnet.provider'
import { QuarkProvider } from './providers/quark/quark.provider'
import { Provider } from './interfaces/provider.interface'

@Module({
  providers: [
    ProviderService,
    PansouProvider,
    MagnetProvider,
    QuarkProvider,
    {
      provide: 'PROVIDERS',
      useFactory: (
        pansou: PansouProvider,
        magnet: MagnetProvider,
        quark: QuarkProvider,
      ): Provider[] => [pansou, magnet, quark],
      inject: [PansouProvider, MagnetProvider, QuarkProvider],
    },
  ],
  exports: [ProviderService],
})
export class ProviderModule {}
