import { Module } from '@nestjs/common';
import { ElectricityPriceModule } from '../shared/electricity-price/electricity-price.module';
import { OptimalScheduleController } from './optimal-schedule.controller';
import { OptimalScheduleService } from './optimal-schedule.service';

@Module({
  imports: [ElectricityPriceModule],
  controllers: [OptimalScheduleController],
  providers: [OptimalScheduleService],
})
export class OptimalScheduleModule {}
