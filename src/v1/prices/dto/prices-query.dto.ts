import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { RestoreOffsetPlus, TIME_FORMAT_NOTE } from '../../common/time-query';

export const RESOLUTIONS = ['15min', 'hour'] as const;
export type Resolution = (typeof RESOLUTIONS)[number];

export class PricesQueryDto {
  @ApiProperty({
    description: `Prices ending after this time. Defaults to midnight today, Finnish time. ${TIME_FORMAT_NOTE}`,
    required: false,
    example: '2026-10-12T00:00:00+03:00',
    type: String,
  })
  @IsOptional()
  @RestoreOffsetPlus()
  @IsDateString()
  from?: string;

  @ApiProperty({
    description: `Prices starting before this time. Defaults to the end of the last published price. ${TIME_FORMAT_NOTE}`,
    required: false,
    example: '2026-10-13T00:00:00+03:00',
    type: String,
  })
  @IsOptional()
  @RestoreOffsetPlus()
  @IsDateString()
  to?: string;

  @ApiProperty({
    description:
      '15min for the market prices as they are, hour for clock-hour averages.',
    required: false,
    enum: RESOLUTIONS,
    default: '15min',
  })
  @IsOptional()
  @IsIn(RESOLUTIONS)
  resolution?: Resolution;
}
