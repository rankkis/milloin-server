import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export const MAX_MIN_CONSECUTIVE_HOURS = 12;

export class OptimalScheduleOptionsDto {
  @ApiProperty({
    description:
      'Earliest time the device may draw power (ISO 8601, Zulu). Defaults to now; earlier times count as now.',
    example: '2025-10-01T19:00:00.000Z',
    required: false,
    type: String,
  })
  @IsOptional()
  @IsDateString()
  earliestStart?: string;

  @ApiProperty({
    description:
      'When the energy must be in (ISO 8601, Zulu), for example when the car leaves. Defaults to the end of the last published price. Prices are published for the next day around 14:00 Finnish time, so a later deadline is searched only up to the last published price (see pricesUntil).',
    example: '2025-10-02T05:00:00.000Z',
    required: false,
    type: String,
  })
  @IsOptional()
  @IsDateString()
  deadlineAt?: string;

  @ApiProperty({
    description: `Shortest time the device runs once switched on, in hours, in steps of 15 minutes (0.25 h), from 0.25 to ${MAX_MIN_CONSECUTIVE_HOURS}. Defaults to 0.25: any cheap 15-minute slot can be used on its own. When less energy is needed than this time gives, the schedule is one block.`,
    example: 1,
    required: false,
    default: 0.25,
    minimum: 0.25,
    maximum: MAX_MIN_CONSECUTIVE_HOURS,
    multipleOf: 0.25,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.25)
  @Max(MAX_MIN_CONSECUTIVE_HOURS)
  minConsecutiveHours?: number;
}

export class OptimalScheduleRequestDto {
  @ApiProperty({
    description: 'Energy needed (kWh)',
    example: 50,
    minimum: 0.01,
    maximum: 1000,
  })
  @IsNumber()
  @Min(0.01)
  @Max(1000)
  energyKwh: number;

  @ApiProperty({
    description:
      'Highest power the device draws (kW), for example the charger power. Each 15-minute slot gives at most a quarter of this in kWh.',
    example: 11,
    minimum: 0.1,
    maximum: 1000,
  })
  @IsNumber()
  @Min(0.1)
  @Max(1000)
  maxPowerKw: number;

  @ApiProperty({
    description: 'Rules for when the energy may be drawn',
    type: OptimalScheduleOptionsDto,
    required: false,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => OptimalScheduleOptionsDto)
  options?: OptimalScheduleOptionsDto;
}
