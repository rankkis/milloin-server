import { Module } from '@nestjs/common';
import { WashLaundryController } from './wash-laundry.controller';
import { WashLaundryService } from './wash-laundry.service';
import { ElectricityPriceModule } from '../shared/electricity-price/electricity-price.module';

@Module({
  imports: [ElectricityPriceModule],
  controllers: [WashLaundryController],
  providers: [WashLaundryService],
})
export class WashLaundryModule {}
