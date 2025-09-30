import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ElectricityPriceFiService } from './electricity-price-fi.service';
import { SpotHintaProvider } from './providers/spot-hinta.provider';
import { DatabaseProvider } from './providers/database.provider';
import { EntsoeDataFetcherService } from './services/entsoe-data-fetcher.service';
import { ElectricityPriceSchedulerService } from './services/electricity-price-scheduler.service';

@Module({
  imports: [CacheModule.register(), ConfigModule, ScheduleModule.forRoot()],
  providers: [
    ElectricityPriceFiService,
    SpotHintaProvider,
    DatabaseProvider,
    EntsoeDataFetcherService,
    ElectricityPriceSchedulerService,
  ],
  exports: [ElectricityPriceFiService],
})
export class ElectricityPriceFiModule {}
