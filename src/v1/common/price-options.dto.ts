import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { VAT_PERCENT } from '../../pricing/vat';

export const AREAS = ['FI'] as const;
export type Area = (typeof AREAS)[number];

/** "true" and "false" in a query string as booleans */
export const QueryBoolean = () =>
  Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  );

/** Options every price and plan endpoint takes */
export class PriceOptionsDto {
  @ApiProperty({
    description: `true (default): prices include ${VAT_PERCENT} % VAT, as consumers pay. false: without VAT, for VAT-registered businesses. Categories are judged on the price with VAT either way.`,
    required: false,
    default: true,
  })
  @IsOptional()
  @QueryBoolean()
  @IsBoolean()
  vat?: boolean;

  @ApiProperty({
    description: 'Bidding zone. Only FI (Finland) for now.',
    required: false,
    enum: AREAS,
    default: 'FI',
  })
  @IsOptional()
  @IsIn(AREAS)
  area?: Area;
}
