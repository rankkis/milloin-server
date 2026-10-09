import { ApiProperty } from '@nestjs/swagger';

export class ScheduleBlockDto {
  @ApiProperty({
    description: 'When to switch on (ISO 8601, Zulu)',
    example: '2025-10-02T01:00:00.000Z',
    type: String,
  })
  startTime: string;

  @ApiProperty({
    description:
      'When to switch off at the latest (ISO 8601, Zulu). Running at maxPowerKw, the energy of the block may be in up to 15 minutes earlier.',
    example: '2025-10-02T03:00:00.000Z',
    type: String,
  })
  endTime: string;

  @ApiProperty({ description: 'Energy drawn in the block (kWh)', example: 22 })
  energyKwh: number;

  @ApiProperty({ description: 'Cost of the block in cents', example: 47.3 })
  costCents: number;

  @ApiProperty({
    description: 'Average price of the energy in the block (cents/kWh)',
    example: 2.15,
  })
  priceAvg: number;
}

export class ScheduleComparisonDto {
  @ApiProperty({
    description: 'When charging would start (ISO 8601, Zulu)',
    example: '2025-10-01T19:00:00.000Z',
    type: String,
  })
  startTime: string;

  @ApiProperty({
    description: 'When the energy would be in (ISO 8601, Zulu)',
    example: '2025-10-01T23:45:00.000Z',
    type: String,
  })
  endTime: string;

  @ApiProperty({ description: 'Cost in cents', example: 412.5 })
  costCents: number;

  @ApiProperty({
    description: 'Average price of the energy (cents/kWh)',
    example: 8.25,
  })
  priceAvg: number;
}

export class OptimalScheduleDto {
  @ApiProperty({ description: 'Energy needed (kWh)', example: 50 })
  energyKwh: number;

  @ApiProperty({ description: 'Highest power drawn (kW)', example: 11 })
  maxPowerKw: number;

  @ApiProperty({
    description:
      'Start of the search (ISO 8601, Zulu): the current 15-minute interval or options.earliestStart',
    example: '2025-10-01T19:00:00.000Z',
    type: String,
  })
  earliestStart: string;

  @ApiProperty({
    description:
      'End of the search (ISO 8601, Zulu): options.deadlineAt or pricesUntil, whichever is earlier',
    example: '2025-10-02T05:00:00.000Z',
    type: String,
  })
  deadlineAt: string;

  @ApiProperty({
    description: 'Shortest block length that was allowed (hours)',
    example: 0.25,
  })
  minConsecutiveHours: number;

  @ApiProperty({
    description:
      'End of the last published price (ISO 8601, Zulu). A later deadline may get a cheaper schedule once the next day is published.',
    example: '2025-10-02T21:00:00.000Z',
    type: String,
  })
  pricesUntil: string;

  @ApiProperty({
    description: 'Cost of the schedule in cents (VAT included, no tariffs)',
    example: 118.6,
  })
  costCents: number;

  @ApiProperty({
    description: 'Average price of the energy (cents/kWh)',
    example: 2.37,
  })
  priceAvg: number;

  @ApiProperty({
    description:
      "The cheapest blocks to draw the energy in, in time order. In each block the device runs at maxPowerKw until the block's energyKwh is in. The blocks are made of 15-minute price intervals.",
    type: [ScheduleBlockDto],
  })
  blocks: ScheduleBlockDto[];

  @ApiProperty({
    description:
      'Charging at maxPowerKw from earliestStart until the energy is in, for comparison. Left out when the prices do not reach far enough.',
    type: ScheduleComparisonDto,
    required: false,
  })
  startRightAway?: ScheduleComparisonDto;

  @ApiProperty({
    description:
      'Cents saved compared with startRightAway. Only when startRightAway is given.',
    example: 293.9,
    required: false,
  })
  savingsCents?: number;
}
