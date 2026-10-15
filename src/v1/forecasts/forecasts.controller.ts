import { Controller, Get, Param } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { HttpCache } from '../../shared/http/http-cache';
import { FORECAST_HORIZONS, Forecast, ForecastHorizon } from './forecast';
import { ForecastsService } from './forecasts.service';

/** Forecasts change once a day */
const FORECAST_CACHE_SECONDS = 10 * 60;

export class ForecastParamsDto {
  @IsIn(FORECAST_HORIZONS)
  horizon: ForecastHorizon;
}

/**
 * Spot price forecasts for milloin-web. Not part of the public API: left
 * out of the OpenAPI document, so the developer docs don't list it.
 */
@ApiExcludeController()
@Controller('v1/electricity/forecasts')
export class ForecastsController {
  constructor(private readonly forecastsService: ForecastsService) {}

  @Get(':horizon')
  @HttpCache(FORECAST_CACHE_SECONDS)
  getForecast(@Param() { horizon }: ForecastParamsDto): Promise<Forecast> {
    return this.forecastsService.getForecast(horizon);
  }
}
