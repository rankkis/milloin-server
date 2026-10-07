import { ApiProperty } from '@nestjs/swagger';
import { PriceCategory } from '../../shared/dto/price-category.enum';
import {
  OptimalTimeDto,
  PricePointDto,
} from '../../shared/dto/optimal-time.dto';

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

export class HourlyPriceDto {
  @ApiProperty({
    description: 'Start of the hour (ISO 8601, UTC)',
    example: '2025-10-02T21:00:00.000Z',
    type: String,
  })
  startTime: string;

  @ApiProperty({
    description: 'End of the hour (ISO 8601, UTC)',
    example: '2025-10-02T22:00:00.000Z',
    type: String,
  })
  endTime: string;

  @ApiProperty({
    description:
      'Average of the 15-minute prices in this hour including VAT (cents/kWh)',
    example: 3.12,
    type: Number,
  })
  priceAvg: number;

  @ApiProperty({
    description:
      'Price category of the hourly average: VERY_CHEAP (<2.5), CHEAP (2.5-5.0), NORMAL (5.0-10.0), EXPENSIVE (10.0-20.0), VERY_EXPENSIVE (>=20.0 c/kWh)',
    example: PriceCategory.CHEAP,
    enum: PriceCategory,
  })
  priceCategory: PriceCategory;
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

  @ApiProperty({
    description:
      'Hourly prices for the current Finnish day, from 00:00 to 24:00 Finnish time, past hours included. 23 or 25 entries on daylight saving change days. Hours without published prices are left out.',
    type: [HourlyPriceDto],
  })
  today: HourlyPriceDto[];

  @ApiProperty({
    description:
      'Cheapest 2-hour window that has not ended yet, within all available prices. Starts at the current quarter hour at the earliest. Left out when less than 2 hours of prices remain.',
    type: OptimalTimeDto,
    required: false,
  })
  cheapestWindow?: OptimalTimeDto;
}
