import { ApiProperty } from '@nestjs/swagger';

export class OptimalTimeDto {
  @ApiProperty({
    description: 'Start time of the optimal washing period (ISO 8601 format)',
    example: '2024-01-01T02:00:00.000Z',
    type: String,
  })
  startTime: string;

  @ApiProperty({
    description: 'End time of the optimal washing period (ISO 8601 format)',
    example: '2024-01-01T04:00:00.000Z',
    type: String,
  })
  endTime: string;

  @ApiProperty({
    description: 'Average electricity price for this 2-hour period (cents/kWh)',
    example: 3.45,
    type: Number,
    minimum: 0,
  })
  price: number;

  @ApiProperty({
    description:
      'Ranking of this time slot (1 = cheapest, 2 = second cheapest, etc.)',
    example: 1,
    type: Number,
    minimum: 1,
    maximum: 5,
  })
  rank: number;

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
