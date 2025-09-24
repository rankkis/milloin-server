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
      - Returns separate recommendations for today, tonight, and tomorrow
      - Only shows options that are available and cost-effective

      **Response Structure:**
      - **today**: Only included if currently daytime (06:00-20:00 Finnish time)
      - **tonight**: Only included if cheaper than today's optimal time (20:01-05:59)
      - **tomorrow**: Only included if cheaper than today's optimal time (06:00-20:00)

      **Pricing Logic:**
      All recommendations are compared against today's optimal daytime price. Only cheaper alternatives are included.

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
    description: 'Successful forecast response with optimal washing times. Returns up to 3 nullable properties: today (if daytime), tonight (if cheaper than today), and tomorrow (if cheaper than today). Each contains a single optimal 2-hour washing slot.',
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
