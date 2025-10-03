import { Module } from '@nestjs/common';
import { OverviewController } from './overview.controller';
import { OverviewService } from './overview.service';
import { ElectricityPriceModule } from '../shared/electricity-price/electricity-price.module';

@Module({
  imports: [ElectricityPriceModule],
  controllers: [OverviewController],
  providers: [OverviewService],
})
export class OverviewModule {}
