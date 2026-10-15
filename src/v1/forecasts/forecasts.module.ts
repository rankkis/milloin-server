import { Module } from '@nestjs/common';
import { ForecastsController } from './forecasts.controller';
import { ForecastsService } from './forecasts.service';

@Module({
  controllers: [ForecastsController],
  providers: [ForecastsService],
})
export class ForecastsModule {}
