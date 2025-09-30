import { Module } from '@nestjs/common';
import { ChargeEvController } from './charge-ev.controller';
import { ChargeEvService } from './charge-ev.service';
import { ElectricityPriceModule } from '../shared/electricity-price/electricity-price.module';

@Module({
  imports: [ElectricityPriceModule],
  controllers: [ChargeEvController],
  providers: [ChargeEvService],
})
export class ChargeEvModule {}
