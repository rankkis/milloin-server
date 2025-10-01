import { ApiProperty } from '@nestjs/swagger';
import { PriceCategory } from './price-category.enum';

export class PricePointDto {
  @ApiProperty({
    description: 'Start time of the price point (ISO 8601 format)',
    example: '2025-10-01T02:00:00.000Z',
    type: String,
  })
  startTime: string;

  @ApiProperty({
    description: 'End time of the price point (ISO 8601 format)',
    example: '2025-10-01T02:15:00.000Z',
    type: String,
  })
  endTime: string;

  @ApiProperty({
    description: 'Electricity price including VAT (cents/kWh)',
    example: 3.45,
    type: Number,
    minimum: 0,
  })
  price: number;
}

export class OptimalTimeDto {
  @ApiProperty({
    description: 'Start time of the optimal period (ISO 8601 format)',
    example: '2024-01-01T02:00:00.000Z',
    type: String,
  })
  startTime: string;

  @ApiProperty({
    description: 'End time of the optimal period (ISO 8601 format)',
    example: '2024-01-01T04:00:00.000Z',
    type: String,
  })
  endTime: string;

  @ApiProperty({
    description:
      'Average electricity price for this period including VAT and tariffs (cents/kWh). Calculated from 15-minute price points. Duration depends on context (2 hours for washing, 4 hours for EV charging, etc.)',
    example: 10.65,
    type: Number,
    minimum: 0,
  })
  priceAvg: number;

  @ApiProperty({
    description:
      'Price category classification based on thresholds: VERY_CHEAP (<2.5), CHEAP (2.5-5.0), NORMAL (5.0-10.0), EXPENSIVE (10.0-20.0), VERY_EXPENSIVE (>=20.0 c/kWh)',
    example: PriceCategory.CHEAP,
    enum: PriceCategory,
  })
  priceCategory: PriceCategory;

  @ApiProperty({
    description:
      'Array of price points at 15-minute intervals between startTime and endTime. Each point includes the quarter-hour period and price with VAT.',
    type: [PricePointDto],
    example: [
      {
        startTime: '2025-10-01T02:00:00.000Z',
        endTime: '2025-10-01T02:15:00.000Z',
        price: 3.45,
      },
      {
        startTime: '2025-10-01T02:15:00.000Z',
        endTime: '2025-10-01T02:30:00.000Z',
        price: 3.52,
      },
    ],
  })
  pricePoints: PricePointDto[];
}
