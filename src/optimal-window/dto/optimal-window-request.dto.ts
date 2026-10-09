import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';

export const MAX_WINDOW_COUNT = 10;
export const DEFAULT_WINDOW_COUNT = 3;
export const MAX_START_OFFSETS = 25;
export const MAX_START_OFFSET_HOURS = 24;

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
      'Electricity used during the whole window (kWh), spread evenly over it. When given, each window also carries its cost and saving.',
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

  @ApiProperty({
    description: `Start times to compare, in hours from the current 15-minute interval: 0 is now, 1 is in an hour, like a timer delay. Steps of 0.25 h, at most ${MAX_START_OFFSET_HOURS} h and ${MAX_START_OFFSETS} offsets. When given, the response lists each offset's window in startOffsets. Not limited by earliestStart or latestEnd.`,
    example: [0, 1, 2, 3, 4, 5],
    required: false,
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_START_OFFSETS)
  @ArrayUnique()
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(MAX_START_OFFSET_HOURS, { each: true })
  startOffsetsHours?: number[];

  @ApiProperty({
    description:
      'When true, startOffsets also lists the window starting at every full hour from the next full hour on, as far as the published prices reach. Like a clock-time start, for example the sauna at 18:00 today or tomorrow. Not limited by earliestStart or latestEnd.',
    example: true,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  startEveryFullHour?: boolean;
}
