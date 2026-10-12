import { Module } from '@nestjs/common';
import { ElectricityPriceModule } from '../../shared/electricity-price/electricity-price.module';
import { HealthController } from './health.controller';

@Module({
  imports: [ElectricityPriceModule],
  controllers: [HealthController],
})
export class HealthModule {}
