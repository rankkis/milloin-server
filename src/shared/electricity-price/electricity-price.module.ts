import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ElectricityPriceService } from './electricity-price.service';
import { SpotHintaProvider } from './providers/spot-hinta.provider';
import { DatabaseProvider } from './providers/database.provider';
import { EntsoeDataFetcherService } from './services/entsoe-data-fetcher.service';
import { ElectricityPriceSchedulerService } from './services/electricity-price-scheduler.service';

@Module({
  imports: [ConfigModule, ScheduleModule.forRoot()],
  providers: [
    ElectricityPriceService,
    SpotHintaProvider,
    DatabaseProvider,
    EntsoeDataFetcherService,
    ElectricityPriceSchedulerService,
  ],
  exports: [ElectricityPriceService],
})
export class ElectricityPriceModule {}
