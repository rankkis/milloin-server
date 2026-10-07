import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ElectricityPriceService } from './electricity-price.service';
import { ELECTRICITY_PRICE_PROVIDERS } from './interfaces/electricity-price-provider.interface';
import { EntsoeProvider } from './providers/entsoe.provider';
import { SpotHintaProvider } from './providers/spot-hinta.provider';
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
  ],
  exports: [ElectricityPriceService],
})
export class ElectricityPriceModule {}
