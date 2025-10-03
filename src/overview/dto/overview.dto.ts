import { ApiProperty } from '@nestjs/swagger';
import { PriceCategory } from '../../shared/dto/price-category.enum';
import { PricePointDto } from '../../shared/dto/optimal-time.dto';

export class CurrentPriceDto {
  @ApiProperty({
    description: 'Current electricity price including VAT (cents/kWh)',
    example: 8.23,
    type: Number,
    minimum: 0,
  })
  price: number;

  @ApiProperty({
    description:
      'Price category classification based on thresholds: VERY_CHEAP (<2.5), CHEAP (2.5-5.0), NORMAL (5.0-10.0), EXPENSIVE (10.0-20.0), VERY_EXPENSIVE (>=20.0 c/kWh)',
    example: PriceCategory.NORMAL,
    enum: PriceCategory,
  })
  priceCategory: PriceCategory;
}

export class FuturePriceSummaryDto {
  @ApiProperty({
    description:
      'Average electricity price for the period including VAT (cents/kWh)',
    example: 6.45,
    type: Number,
    minimum: 0,
  })
  priceAvg: number;

  @ApiProperty({
    description:
      'Price category classification based on average price thresholds: VERY_CHEAP (<2.5), CHEAP (2.5-5.0), NORMAL (5.0-10.0), EXPENSIVE (10.0-20.0), VERY_EXPENSIVE (>=20.0 c/kWh)',
    example: PriceCategory.NORMAL,
    enum: PriceCategory,
  })
  priceCategory: PriceCategory;

  @ApiProperty({
    description:
      'Array of price points at 15-minute intervals. Each point includes the quarter-hour period and price with VAT.',
    type: [PricePointDto],
    example: [
      {
        startTime: '2025-10-03T10:00:00.000Z',
        endTime: '2025-10-03T10:15:00.000Z',
        price: 6.12,
      },
      {
        startTime: '2025-10-03T10:15:00.000Z',
        endTime: '2025-10-03T10:30:00.000Z',
        price: 6.45,
      },
    ],
  })
  pricePoints: PricePointDto[];
}

export class OverviewDto {
  @ApiProperty({
    description: 'Current electricity price information',
    type: CurrentPriceDto,
  })
  current: CurrentPriceDto;

  @ApiProperty({
    description: 'Price summary for the next 12 hours',
    type: FuturePriceSummaryDto,
  })
  next12Hours: FuturePriceSummaryDto;

  @ApiProperty({
    description:
      'Price summary for all available future data (today + tomorrow if available)',
    type: FuturePriceSummaryDto,
  })
  future: FuturePriceSummaryDto;
}
