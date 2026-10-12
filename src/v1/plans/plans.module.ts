import { Module } from '@nestjs/common';
import { ElectricityPriceModule } from '../../shared/electricity-price/electricity-price.module';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
  imports: [ElectricityPriceModule],
  controllers: [PlansController],
  providers: [PlansService],
})
export class PlansModule {}
