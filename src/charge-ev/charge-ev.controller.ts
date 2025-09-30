import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiServiceUnavailableResponse,
} from '@nestjs/swagger';
import { ChargeEvService } from './charge-ev.service';
import { ChargeForecastDto } from './dto/charge-forecast.dto';

@ApiTags('charge-ev')
@Controller('charge-ev')
export class ChargeEvController {
  constructor(private readonly chargeEvService: ChargeEvService) {}

  @Get('forecast')
  @ApiOperation({
    summary: 'Get optimal EV charging time forecast',
    description: `
      Returns optimal times to charge an electric vehicle based on Finnish electricity spot prices.

      **How it works:**
      - Fetches electricity prices from ENTSO-E Transparency Platform (with spot-hinta.fi as fallback)
      - Prices include 25.5% Finnish VAT for accurate consumer pricing
      - Calculates optimal 4-hour consecutive time slots for EV charging
      - Returns recommendation for next 12 hours and optional extended period

      **Response Structure:**
      - **next12Hours**: Always included - cheapest 4-hour period in the next 12 hours
      - **extended**: Only included if there's a cheaper 4-hour period in all available data (today + tomorrow)

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
      'Successful forecast response with optimal EV charging times. Always returns next12Hours with the cheapest 4-hour period. Optionally includes extended period if cheaper option exists in all available data.',
    type: ChargeForecastDto,
  })
  @ApiServiceUnavailableResponse({
    description:
      'Electricity price service is unavailable. This can occur when both ENTSO-E API and fallback provider (spot-hinta.fi) are down or experiencing issues.',
  })
  async getForecast(): Promise<ChargeForecastDto> {
    return this.chargeEvService.getForecast();
  }
}
