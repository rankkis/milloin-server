import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { getCache } from '@vercel/functions';
import { ElectricityPriceService } from './electricity-price.service';
import { ELECTRICITY_PRICE_PROVIDERS } from './interfaces/electricity-price-provider.interface';
import { EntsoeProvider } from './providers/entsoe.provider';
import { SpotHintaProvider } from './providers/spot-hinta.provider';
import { SHARED_PRICE_CACHE } from './interfaces/shared-price-cache.interface';
import { PriceCacheService } from './services/price-cache.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  providers: [
    ElectricityPriceService,
    PriceCacheService,
    EntsoeProvider,
    SpotHintaProvider,
    {
      // Price sources in priority order
      provide: ELECTRICITY_PRICE_PROVIDERS,
      useFactory: (entsoe: EntsoeProvider, spotHinta: SpotHintaProvider) => [
        entsoe,
        spotHinta,
      ],
      inject: [EntsoeProvider, SpotHintaProvider],
    },
    {
      // Vercel runtime cache; falls back to process memory outside Vercel.
      // Namespaced because Hobby plan projects share one cache.
      provide: SHARED_PRICE_CACHE,
      useFactory: () => getCache({ namespace: 'milloin-server' }),
    },
  ],
  exports: [ElectricityPriceService],
})
export class ElectricityPriceModule {}
