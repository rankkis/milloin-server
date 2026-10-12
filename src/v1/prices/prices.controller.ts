import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PriceOptionsDto } from '../common/price-options.dto';
import { PRICES_UNAVAILABLE } from '../common/responses';
import { PricesQueryDto } from './dto/prices-query.dto';
import { PriceNowDto, PricesDto } from './dto/prices.dto';
import { PricesService } from './prices.service';

@ApiTags('prices')
@Controller('v1/prices')
export class PricesController {
  constructor(private readonly pricesService: PricesService) {}

  @Get()
  @ApiOperation({
    operationId: 'getPrices',
    summary: 'Prices from a time to a time',
    description: `
Day-ahead spot prices for Finland in c/kWh including VAT, with the price now and when the
published prices end. By default from midnight today (Finnish time) to the last published price:
today's prices, and tomorrow's from about 14:00 Finnish time.

For a Home Assistant REST sensor, \`current.price\` is the state and \`prices\` the attribute.
    `,
  })
  @ApiOkResponse({ type: PricesDto })
  @ApiBadRequestResponse({ description: 'A query parameter is not valid' })
  @ApiServiceUnavailableResponse({ description: PRICES_UNAVAILABLE })
  getPrices(@Query() query: PricesQueryDto): Promise<PricesDto> {
    return this.pricesService.getPrices(query);
  }

  @Get('current')
  @ApiOperation({
    operationId: 'getCurrentPrice',
    summary: 'The price now',
    description:
      "This quarter hour's price and category, a few hundred bytes for frequent polling.",
  })
  @ApiOkResponse({ type: PriceNowDto })
  @ApiBadRequestResponse({ description: 'A query parameter is not valid' })
  @ApiServiceUnavailableResponse({ description: PRICES_UNAVAILABLE })
  getCurrentPrice(@Query() options: PriceOptionsDto): Promise<PriceNowDto> {
    return this.pricesService.getCurrentPrice(options);
  }
}
