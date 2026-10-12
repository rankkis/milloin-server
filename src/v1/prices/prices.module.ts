import { Module } from '@nestjs/common';
import { ElectricityPriceModule } from '../../shared/electricity-price/electricity-price.module';
import { PricesController } from './prices.controller';
import { PricesService } from './prices.service';

@Module({
  imports: [ElectricityPriceModule],
  controllers: [PricesController],
  providers: [PricesService],
})
export class PricesModule {}
