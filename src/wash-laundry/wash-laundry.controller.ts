import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { WashLaundryService } from './wash-laundry.service';
import { WashLaundryForecastDto } from './dto/wash-laundry-forecast.dto';
import { calculateCacheTtl } from '../shared/utils/cache-ttl.helper';

@ApiTags('wash-laundry')
@Controller('wash-laundry')
export class WashLaundryController {
  constructor(private readonly washLaundryService: WashLaundryService) {}

  @Get('optimal-schedule')
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(calculateCacheTtl())
  @ApiOperation({
    summary: 'Get optimal laundry washing schedule',
    description: `
      Returns optimal schedule for washing laundry based on Finnish electricity spot prices.

      **How it works:**
      - Fetches electricity prices from ENTSO-E Transparency Platform (with spot-hinta.fi as fallback)
      - Prices include 25.5% Finnish VAT for accurate consumer pricing
      - Calculates optimal 2-hour consecutive time slots for laundry washing cycles
      - Returns separate recommendations for today, tonight, and tomorrow
      - Only shows options that are available and cost-effective

      **Response Structure:**
      - **today**: Only included if currently daytime (06:00-20:00 Finnish time)
      - **tonight**: Only included if cheaper than today's optimal price (20:01-05:59)
      - **tomorrow**: Included during night time OR during day time if cheaper than today (06:00-20:00)

      **Pricing Logic:**
      All recommendations show potential savings compared to the current hour price when available.

      **Caching:**
      Data is cached with dynamic TTL that expires at the end of the hour when the optimal time starts,
      ensuring fresh recommendations when electricity prices change.
    `,
  })
  @ApiResponse({
    status: 200,
    description:
      'Successful response with optimal laundry washing schedule. Returns up to 3 nullable properties: today (if daytime), tonight (if cheaper than today), and tomorrow (during night time OR if cheaper than today during day time). Each optimal time contains a single 2-hour washing slot.',
    type: WashLaundryForecastDto,
  })
  @ApiServiceUnavailableResponse({
    description:
      'Electricity price service is unavailable. This can occur when both ENTSO-E API and fallback provider (spot-hinta.fi) are down or experiencing issues.',
  })
  async getOptimalSchedule(): Promise<WashLaundryForecastDto> {
    return this.washLaundryService.getOptimalSchedule();
  }
}
