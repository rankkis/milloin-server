import { Module } from '@nestjs/common';
import { ElectricityPriceModule } from '../shared/electricity-price/electricity-price.module';
import { OptimalWindowController } from './optimal-window.controller';
import { OptimalWindowService } from './optimal-window.service';

@Module({
  imports: [ElectricityPriceModule],
  controllers: [OptimalWindowController],
  providers: [OptimalWindowService],
})
export class OptimalWindowModule {}
