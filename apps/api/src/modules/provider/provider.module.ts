import { Module } from '@nestjs/common'
import { ProviderService } from './provider.service'
import { PansouProvider } from './providers/pansou/pansou.provider'
import { MagnetProvider } from './providers/magnet/magnet.provider'
import { QuarkProvider } from './providers/quark/quark.provider'
import { TgChannelProvider } from './providers/tg-channel/tg-channel.provider'
import { TgDirectProvider } from './providers/tg-direct/tg-direct.provider'
import { ForumProvider } from './providers/forum/forum.provider'
import { DhtProvider } from './providers/dht/dht.provider'
import { PansouMirrorProvider } from './providers/pansou-mirror/pansou-mirror.provider'
import { JackettProvider } from './providers/jackett/jackett.provider'
import { Provider } from './interfaces/provider.interface'

@Module({
  providers: [
    ProviderService,
    PansouProvider,
    MagnetProvider,
    QuarkProvider,
    TgChannelProvider,
    TgDirectProvider,
    ForumProvider,
    DhtProvider,
    PansouMirrorProvider,
    JackettProvider,
    {
      provide: 'PROVIDERS',
      useFactory: (
        pansou: PansouProvider,
        magnet: MagnetProvider,
        quark: QuarkProvider,
        tgChannel: TgChannelProvider,
        tgDirect: TgDirectProvider,
        forum: ForumProvider,
        dht: DhtProvider,
        pansouMirror: PansouMirrorProvider,
        jackett: JackettProvider,
      ): Provider[] => [
        pansou,
        magnet,
        quark,
        tgChannel,
        tgDirect,
        forum,
        dht,
        pansouMirror,
        jackett,
      ],
      inject: [
        PansouProvider,
        MagnetProvider,
        QuarkProvider,
        TgChannelProvider,
        TgDirectProvider,
        ForumProvider,
        DhtProvider,
        PansouMirrorProvider,
        JackettProvider,
      ],
    },
  ],
  exports: [ProviderService],
})
export class ProviderModule {}
