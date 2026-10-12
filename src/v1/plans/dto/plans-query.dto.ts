import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { PriceOptionsDto, QueryBoolean } from '../../common/price-options.dto';
import { RestoreOffsetPlus, TIME_FORMAT_NOTE } from '../../common/time-query';
import { RESOLUTIONS, Resolution } from '../../prices/dto/prices-query.dto';

export const DEFAULT_PLAN_LIMIT = 3;
export const MAX_PLAN_LIMIT = 10;
export const MAX_DURATION_HOURS = 24;
export const MAX_MIN_BLOCK_HOURS = 12;

/** Words accepted for a time: Finnish midnight at the start of that day */
export const DAY_KEYWORDS = ['today', 'tomorrow'] as const;

const isKeyword = (value: unknown): boolean =>
  (DAY_KEYWORDS as readonly unknown[]).includes(value);

export class PlansQueryDto extends PriceOptionsDto {
  @ApiProperty({
    description:
      'How long the load runs, in hours in steps of 0.25 (15 minutes). For a pausable load, the total time on. Give this, or energyKwh with maxPowerKw.',
    required: false,
    example: 2,
    minimum: 0.25,
    maximum: MAX_DURATION_HOURS,
    multipleOf: 0.25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.25)
  @Max(MAX_DURATION_HOURS)
  durationHours?: number;

  @ApiProperty({
    description:
      'Energy the load uses in kWh. With durationHours it is spread evenly over the run, and gives each plan its cost. With maxPowerKw (and no durationHours) the load runs at full power until the energy is in.',
    required: false,
    example: 1.5,
    minimum: 0.01,
    maximum: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(1000)
  energyKwh?: number;

  @ApiProperty({
    description:
      'Highest power the load draws in kW, for example a charger’s 11 kW. Used with energyKwh instead of durationHours.',
    required: false,
    example: 11,
    minimum: 0.1,
    maximum: 1000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(1000)
  maxPowerKw?: number;

  @ApiProperty({
    description:
      'false (default): the load runs without a break once started, like a washing machine, and plans are ranked alternatives. true: it may pause, like an EV charger or water heater, and the answer is the single cheapest plan of one or more blocks.',
    required: false,
    default: false,
  })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  pausable?: boolean;

  @ApiProperty({
    description: `Pausable loads only: the shortest time the load runs once switched on, in hours in steps of 0.25, up to ${MAX_MIN_BLOCK_HOURS}. Defaults to 0.25.`,
    required: false,
    example: 1,
    default: 0.25,
    minimum: 0.25,
    maximum: MAX_MIN_BLOCK_HOURS,
    multipleOf: 0.25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.25)
  @Max(MAX_MIN_BLOCK_HOURS)
  minBlockHours?: number;

  @ApiProperty({
    description: `Earliest start. Defaults to the current quarter hour. May be in the past, back to midnight today (Finnish time): a plan searched from a fixed start stays the same as time passes, so a device can follow it. "today" and "tomorrow" mean midnight at the start of that day, Finnish time. ${TIME_FORMAT_NOTE}`,
    required: false,
    example: 'today',
    type: String,
  })
  @IsOptional()
  @RestoreOffsetPlus()
  @ValidateIf((query: PlansQueryDto) => !isKeyword(query.earliestStart))
  @IsDateString()
  earliestStart?: string;

  @ApiProperty({
    description: `Latest end, for example when the car leaves. Defaults to the end of the last published price, and later times are searched only that far (see meta.pricesUntil). "tomorrow" is midnight tonight, Finnish time. ${TIME_FORMAT_NOTE}`,
    required: false,
    example: '2026-10-13T08:00:00+03:00',
    type: String,
  })
  @IsOptional()
  @RestoreOffsetPlus()
  @ValidateIf((query: PlansQueryDto) => !isKeyword(query.latestEnd))
  @IsDateString()
  latestEnd?: string;

  @ApiProperty({
    description: `Continuous loads only: how many plans to return, cheapest first and not overlapping, from 1 to ${MAX_PLAN_LIMIT}.`,
    required: false,
    default: DEFAULT_PLAN_LIMIT,
    minimum: 1,
    maximum: MAX_PLAN_LIMIT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PLAN_LIMIT)
  limit?: number;

  @ApiProperty({
    description:
      '15min (default) plans on the market prices as they are. hour plans on clock-hour averages, for contracts priced by the hour: runs then start on full hours, and durationHours and minBlockHours must be whole hours.',
    required: false,
    enum: RESOLUTIONS,
    default: '15min',
  })
  @IsOptional()
  @IsIn(RESOLUTIONS)
  resolution?: Resolution;
}
