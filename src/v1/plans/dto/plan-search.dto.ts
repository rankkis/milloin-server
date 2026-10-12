import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { PlansQueryDto } from './plans-query.dto';

export const MAX_START_TIMES = 100;
export const MAX_PROFILE_SLOTS = 96;

export class PlanSearchDto extends PlansQueryDto {
  @ApiProperty({
    description: `Energy in kWh for each 15-minute slot of the run, for a load whose power changes, for example a sauna heater drawing more in its first hour. Replaces durationHours, energyKwh and maxPowerKw. At most ${MAX_PROFILE_SLOTS} slots; continuous loads only.`,
    required: false,
    example: [1, 1, 1, 1, 0.5, 0.5, 0.5, 0.5],
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_PROFILE_SLOTS)
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(1000, { each: true })
  profileKwh?: number[];

  @ApiProperty({
    description: `Start times to compare, for example the delays a washing machine's timer offers. Each is rounded down to its quarter hour and answered in startTimes, also outside earliestStart and latestEnd. At most ${MAX_START_TIMES}; continuous loads only.`,
    required: false,
    example: ['2026-10-12T16:00:00Z', '2026-10-12T17:00:00Z'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_START_TIMES)
  @ArrayUnique()
  @IsDateString({}, { each: true })
  startTimes?: string[];
}
