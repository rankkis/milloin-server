import { ApiProperty } from '@nestjs/swagger';
import { OptimalTimeDto } from './optimal-time.dto';

class DayTimeDto {
  @ApiProperty({
    description: 'Top 5 optimal washing times during day hours (06:00-20:00)',
    type: [OptimalTimeDto],
  })
  optimalTimes: OptimalTimeDto[];

  @ApiProperty({
    description: 'Average electricity price during day hours (cents/kWh)',
    example: 8.45,
    type: Number,
    minimum: 0,
  })
  averagePrice: number;

  @ApiProperty({
    description: 'Lowest electricity price during day hours (cents/kWh)',
    example: 6.2,
    type: Number,
    minimum: 0,
  })
  lowestPrice: number;
}

class NightTimeDto {
  @ApiProperty({
    description: 'Top 5 optimal washing times during night hours (20:01-05:59)',
    type: [OptimalTimeDto],
  })
  optimalTimes: OptimalTimeDto[];

  @ApiProperty({
    description: 'Average electricity price during night hours (cents/kWh)',
    example: 4.15,
    type: Number,
    minimum: 0,
  })
  averagePrice: number;

  @ApiProperty({
    description: 'Lowest electricity price during night hours (cents/kWh)',
    example: 2.8,
    type: Number,
    minimum: 0,
  })
  lowestPrice: number;

  @ApiProperty({
    description:
      'Amount saved compared to cheapest day time option (cents/kWh)',
    example: 3.4,
    type: Number,
    minimum: 0,
  })
  savingsVsDayTime: number;

  @ApiProperty({
    description: 'Percentage savings compared to cheapest day time option',
    example: 54.84,
    type: Number,
    minimum: 0,
    maximum: 100,
  })
  savingsPercentageVsDayTime: number;
}

class OptimalTimeOverallDto {
  @ApiProperty({
    description:
      'Start time of the absolute cheapest washing period (ISO 8601 format)',
    example: '2024-01-01T02:00:00.000Z',
    type: String,
  })
  startTime: string;

  @ApiProperty({
    description:
      'End time of the absolute cheapest washing period (ISO 8601 format)',
    example: '2024-01-01T04:00:00.000Z',
    type: String,
  })
  endTime: string;

  @ApiProperty({
    description: 'Price of the absolute cheapest washing period (cents/kWh)',
    example: 2.8,
    type: Number,
    minimum: 0,
  })
  price: number;

  @ApiProperty({
    description: 'Time period of the cheapest slot',
    example: 'night',
    enum: ['day', 'night'],
  })
  period: 'day' | 'night';
}

class SavingsDto {
  @ApiProperty({
    description:
      'Maximum possible savings compared to average price (cents/kWh)',
    example: 2.65,
    type: Number,
    minimum: 0,
  })
  maxSavings: number;

  @ApiProperty({
    description: 'Maximum possible savings as percentage of average price',
    example: 48.62,
    type: Number,
    minimum: 0,
    maximum: 100,
  })
  savingsPercentage: number;
}

class OverallStatsDto {
  @ApiProperty({
    description:
      'Average electricity price across all forecast hours (cents/kWh)',
    example: 5.45,
    type: Number,
    minimum: 0,
  })
  averagePrice: number;

  @ApiProperty({
    description: 'Lowest electricity price in forecast period (cents/kWh)',
    example: 2.8,
    type: Number,
    minimum: 0,
  })
  lowestPrice: number;

  @ApiProperty({
    description: 'Highest electricity price in forecast period (cents/kWh)',
    example: 12.3,
    type: Number,
    minimum: 0,
  })
  highestPrice: number;

  @ApiProperty({
    description:
      'Information about the absolute best time to run the washing machine',
    type: OptimalTimeOverallDto,
  })
  optimalTime: OptimalTimeOverallDto;

  @ApiProperty({
    description: 'Savings information compared to average prices',
    type: SavingsDto,
  })
  savings: SavingsDto;
}

export class WashingForecastDto {
  @ApiProperty({
    description:
      'Optimal washing times during day hours (06:00-20:00). Latest start time is 20:00 to allow 2-hour cycle completion by 22:00.',
    type: DayTimeDto,
  })
  dayTime: DayTimeDto;

  @ApiProperty({
    description:
      'Optimal washing times during night hours (20:01-05:59). Only included if night times are cheaper than day times.',
    type: NightTimeDto,
    required: false,
  })
  nightTime?: NightTimeDto;

  @ApiProperty({
    description:
      'Overall statistics and the absolute best washing time across all periods',
    type: OverallStatsDto,
  })
  overallStats: OverallStatsDto;
}
