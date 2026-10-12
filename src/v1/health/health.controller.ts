import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Clock } from '../../shared/clock/clock';
import { ElectricityPriceService } from '../../shared/electricity-price/electricity-price.service';
import { HttpCache } from '../../shared/http/http-cache';
import { ProblemDto } from '../../shared/http/problem-details';
import { PRICES_UNAVAILABLE } from '../common/responses';

/** Tomorrow's prices count as late this long after they are expected */
const LATE_AFTER_MS = 60 * 60 * 1000;

export class HealthDto {
  @ApiProperty({
    description:
      "ok: the current price is in memory and tomorrow's prices are not late. late: tomorrow's prices are over an hour later than expected; today's still work.",
    enum: ['ok', 'late'],
    example: 'ok',
  })
  status: 'ok' | 'late';

  @ApiProperty({ example: '2026-10-13T21:00:00.000Z' })
  pricesUntil: string;

  @ApiProperty({ example: true })
  tomorrowPublished: boolean;

  @ApiProperty({ example: '2026-10-13T11:00:00.000Z' })
  nextPricesExpectedAt: string;

  @ApiProperty({ example: 'ENTSO-E', required: false })
  source?: string;

  @ApiProperty({ example: '2026-10-12T11:02:13.000Z', required: false })
  fetchedAt?: string;
}

@ApiTags('health')
@Controller('v1/electricity/health')
export class HealthController {
  constructor(
    private readonly electricityPriceService: ElectricityPriceService,
    private readonly clock: Clock,
  ) {}

  @Get()
  @HttpCache(60)
  @ApiOperation({
    operationId: 'getHealth',
    summary: 'Whether the prices are fresh',
    description:
      "For monitoring, and for clients that want to ask for tomorrow's prices only once they can exist. Answers 503 when there is no current price.",
  })
  @ApiOkResponse({ type: HealthDto })
  @ApiServiceUnavailableResponse({
    description: PRICES_UNAVAILABLE,
    type: ProblemDto,
  })
  async getHealth(): Promise<HealthDto> {
    await this.electricityPriceService.getCurrentPrice();
    const prices = await this.electricityPriceService.getPrices();
    const freshness = this.electricityPriceService.getFreshness(prices);
    const late =
      !freshness.tomorrowPublished &&
      this.clock.now() >
        Date.parse(freshness.nextPricesExpectedAt) + LATE_AFTER_MS;
    return { status: late ? 'late' : 'ok', ...freshness };
  }
}
