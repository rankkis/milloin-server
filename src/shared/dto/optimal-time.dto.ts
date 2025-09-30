import { ApiProperty } from '@nestjs/swagger';
import { PriceCategory } from './price-category.enum';

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
      'Average electricity price for this period (cents/kWh). Duration depends on context (2 hours for washing, 4 hours for EV charging, etc.)',
    example: 3.45,
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
      'Estimated total electricity price for this period (cents/kWh). Includes spot price + exchange tariff (6.7 c/kWh) + margin tariff (0.5 c/kWh). Calculated using actual hourly prices, not the average.',
    example: 10.65,
    type: Number,
    minimum: 0,
  })
  estimatedTotalPrice: number;

  @ApiProperty({
    description:
      'Potential amount saved compared to current hour price (cents/kWh). Null when current hour is optimal.',
    example: 1.25,
    type: Number,
    required: false,
    nullable: true,
  })
  potentialSavings: number | null;

  @ApiProperty({
    description:
      'Potential percentage savings compared to current hour price. Null when current hour is optimal.',
    example: 26.32,
    type: Number,
    minimum: 0,
    maximum: 100,
    required: false,
    nullable: true,
  })
  potentialSavingsPercentage: number | null;
}
