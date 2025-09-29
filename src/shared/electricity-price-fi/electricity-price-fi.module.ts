import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import { ElectricityPriceFiService } from './electricity-price-fi.service';
import { SpotHintaProvider } from './providers/spot-hinta.provider';

@Module({
  imports: [CacheModule.register(), ConfigModule],
  providers: [ElectricityPriceFiService, SpotHintaProvider],
  exports: [ElectricityPriceFiService],
})
export class ElectricityPriceFiModule {}
