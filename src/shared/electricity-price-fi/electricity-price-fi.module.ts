import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ElectricityPriceFiService } from './electricity-price-fi.service';

@Module({
  imports: [CacheModule.register()],
  providers: [ElectricityPriceFiService],
  exports: [ElectricityPriceFiService],
})
export class ElectricityPriceFiModule {}
