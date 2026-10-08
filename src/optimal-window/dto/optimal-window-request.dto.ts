import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export const MAX_WINDOW_COUNT = 10;
export const DEFAULT_WINDOW_COUNT = 3;

export class OptimalWindowRequestDto {
  @ApiProperty({
    description:
      'Length of the window in hours, in steps of 15 minutes (0.25 h), from 0.25 to 24.',
    example: 3,
    minimum: 0.25,
    maximum: 24,
    multipleOf: 0.25,
  })
  @IsNumber()
  @Min(0.25)
  @Max(24)
  durationHours: number;

  @ApiProperty({
    description:
      'Electricity used during the window (kWh). When given, each window also carries its cost and saving.',
    example: 7,
    required: false,
    minimum: 0,
    maximum: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  energyKwh?: number;

  @ApiProperty({
    description:
      'Earliest start of a window (ISO 8601, Zulu). Defaults to now; earlier times count as now.',
    example: '2025-10-01T16:00:00.000Z',
    required: false,
    type: String,
  })
  @IsOptional()
  @IsDateString()
  earliestStart?: string;

  @ApiProperty({
    description:
      'Latest end of a window (ISO 8601, Zulu). Defaults to the end of the last published price.',
    example: '2025-10-02T06:00:00.000Z',
    required: false,
    type: String,
  })
  @IsOptional()
  @IsDateString()
  latestEnd?: string;

  @ApiProperty({
    description: `How many windows to return, from 1 to ${MAX_WINDOW_COUNT}.`,
    example: DEFAULT_WINDOW_COUNT,
    required: false,
    default: DEFAULT_WINDOW_COUNT,
    minimum: 1,
    maximum: MAX_WINDOW_COUNT,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_WINDOW_COUNT)
  count?: number;
}
