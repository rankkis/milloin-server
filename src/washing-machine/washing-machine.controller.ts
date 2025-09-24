import { Controller, Get, Query, BadRequestException } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBadRequestResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { WashingMachineService } from './washing-machine.service';
import { WashingForecastDto } from './dto/washing-forecast.dto';

@ApiTags('washing-machine')
@Controller('washing-machine')
export class WashingMachineController {
  constructor(private readonly washingMachineService: WashingMachineService) {}

  @Get('forecast')
  @ApiOperation({
    summary: 'Get optimal washing machine timing forecast',
    description: `
      Returns optimal times to run a washing machine based on Finnish electricity spot prices.

      **How it works:**
      - Fetches real-time electricity prices from spot-hinta.fi API (Nord Pool data)
      - Calculates optimal 2-hour consecutive time slots for washing machine cycles
      - Separates recommendations into day (06:00-20:00) and night (20:01-05:59) periods
      - Night times are only included if they're cheaper than day times
      - Results are cached until the end of the hour when the optimal time starts

      **Time Periods:**
      - **Day Time**: 06:00-20:00 (latest start time allows 2-hour cycle to finish by 22:00)
      - **Night Time**: 20:01-05:59 (only shown if cheaper than day options)

      **Caching:**
      Data is cached with dynamic TTL that expires at the end of the hour when the optimal time starts,
      ensuring fresh recommendations when electricity prices change.
    `,
  })
  @ApiQuery({
    name: 'hours',
    required: false,
    type: Number,
    description: 'Number of hours to forecast (default: 24, min: 1, max: 48)',
    example: 24,
    schema: {
      minimum: 1,
      maximum: 48,
      default: 24,
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Successful forecast response with optimal washing times. Returns optimal 2-hour washing slots separated by day (06:00-20:00) and night (20:01-05:59) periods. Night times are only included if they offer better savings than day times.',
    type: WashingForecastDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid request parameters. Common causes: hours parameter out of range (1-48), invalid format, or insufficient price data available for the requested forecast period.',
  })
  @ApiServiceUnavailableResponse({
    description: 'External electricity price API (spot-hinta.fi) is unavailable. This can occur when the Finnish electricity price API is down or experiencing issues.',
  })
  async getForecast(
    @Query('hours') hours?: string,
  ): Promise<WashingForecastDto> {
    let forecastHours = 24;

    if (hours) {
      const parsedHours = parseInt(hours, 10);
      if (isNaN(parsedHours) || parsedHours < 1 || parsedHours > 48) {
        throw new BadRequestException(
          'Hours parameter must be a number between 1 and 48',
        );
      }
      forecastHours = parsedHours;
    }

    return this.washingMachineService.getForecast(forecastHours);
  }
}
