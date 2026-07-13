import { Module } from '@nestjs/common'
import { ProviderService } from './provider.service'
import { PansouProvider } from './providers/pansou/pansou.provider'
import { MagnetProvider } from './providers/magnet/magnet.provider'
import { QuarkProvider } from './providers/quark/quark.provider'
import { TgChannelProvider } from './providers/tg-channel/tg-channel.provider'
import { Provider } from './interfaces/provider.interface'

@Module({
  providers: [
    ProviderService,
    PansouProvider,
    MagnetProvider,
    QuarkProvider,
    TgChannelProvider,
    {
      provide: 'PROVIDERS',
      useFactory: (
        pansou: PansouProvider,
        magnet: MagnetProvider,
        quark: QuarkProvider,
        tgChannel: TgChannelProvider,
      ): Provider[] => [pansou, magnet, quark, tgChannel],
      inject: [PansouProvider, MagnetProvider, QuarkProvider, TgChannelProvider],
    },
  ],
  exports: [ProviderService],
})
export class ProviderModule {}
