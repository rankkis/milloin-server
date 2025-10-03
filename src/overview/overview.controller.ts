import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { OverviewService } from './overview.service';
import { OverviewDto } from './dto/overview.dto';
import { calculateCacheTtl } from '../shared/utils/cache-ttl.helper';

@ApiTags('overview')
@Controller('overview')
export class OverviewController {
  constructor(private readonly overviewService: OverviewService) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(calculateCacheTtl())
  @ApiOperation({
    summary: 'Get electricity price overview',
    description: `
      Returns a comprehensive overview of current and future electricity prices.

      **How it works:**
      - Fetches current and future electricity prices from ENTSO-E Transparency Platform (with spot-hinta.fi as fallback)
      - All prices include 25.5% Finnish VAT for accurate consumer pricing
      - Provides current price, next 12 hours summary, and all available future data

      **Response Structure:**
      - **current**: Current hour price and category classification
      - **next12Hours**: Average price, category, and 15-minute price points for the next 12 hours
      - **future**: Average price, category, and 15-minute price points for all available data (today + tomorrow)

      **Price Categories:**
      - VERY_CHEAP: < 2.5 c/kWh
      - CHEAP: 2.5-5.0 c/kWh
      - NORMAL: 5.0-10.0 c/kWh
      - EXPENSIVE: 10.0-20.0 c/kWh
      - VERY_EXPENSIVE: >= 20.0 c/kWh

      **Caching:**
      Data is cached with dynamic TTL that expires at 15-minute intervals (:00, :15, :30, :45),
      ensuring fresh recommendations when electricity prices change.
    `,
  })
  @ApiResponse({
    status: 200,
    description:
      'Successful response with electricity price overview including current price, next 12 hours summary, and future price data.',
    type: OverviewDto,
  })
  @ApiServiceUnavailableResponse({
    description:
      'Electricity price service is unavailable. This can occur when both ENTSO-E API and fallback provider (spot-hinta.fi) are down or experiencing issues.',
  })
  async getOverview(): Promise<OverviewDto> {
    return this.overviewService.getOverview();
  }
}
