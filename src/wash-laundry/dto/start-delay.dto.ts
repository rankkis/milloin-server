import { ApiProperty } from '@nestjs/swagger';
import { PriceCategory } from '../../shared/dto/price-category.enum';

export class StartDelayDto {
  @ApiProperty({
    description:
      'Hours to set on the washing machine timer. 0 means starting now.',
    example: 1,
    minimum: 0,
    maximum: 5,
  })
  delayHours: number;

  @ApiProperty({
    description:
      'Start of the washing program (ISO 8601, Zulu). The current 15-minute interval plus delayHours, so the response stays valid while it is cached.',
    example: '2025-10-01T11:30:00.000Z',
    type: String,
  })
  startTime: string;

  @ApiProperty({
    description: 'End of the 2-hour washing program (ISO 8601, Zulu)',
    example: '2025-10-01T13:30:00.000Z',
    type: String,
  })
  endTime: string;

  @ApiProperty({
    description:
      'Average electricity price during the program including VAT, without tariffs (cents/kWh)',
    example: 4.02,
    minimum: 0,
  })
  priceAvg: number;

  @ApiProperty({
    description: 'Price category of priceAvg',
    enum: PriceCategory,
    example: PriceCategory.CHEAP,
  })
  priceCategory: PriceCategory;

  @ApiProperty({
    description:
      'Electricity cost of one wash in cents: priceAvg × defaults.powerConsumptionKwh',
    example: 4.02,
    minimum: 0,
  })
  costCents: number;

  @ApiProperty({
    description:
      'True for the cheapest delay. On a tie, the earliest delay is the best.',
    example: true,
  })
  isBest: boolean;
}
