import { ApiProperty } from '@nestjs/swagger';
import { PriceCategory } from '../../../pricing/price-category';
import { VAT_PERCENT } from '../../../pricing/vat';
import { RESOLUTIONS, Resolution } from './prices-query.dto';

const CATEGORY_DESCRIPTION =
  'VERY_CHEAP under 2.5, CHEAP under 5, NORMAL under 10, EXPENSIVE under 20, VERY_EXPENSIVE from 20 c/kWh';

export class PriceDto {
  @ApiProperty({
    description: 'Start (ISO 8601, UTC)',
    example: '2026-10-12T07:00:00.000Z',
  })
  startTime: string;

  @ApiProperty({
    description: 'End (ISO 8601, UTC)',
    example: '2026-10-12T07:15:00.000Z',
  })
  endTime: string;

  @ApiProperty({
    description: `Price in c/kWh including ${VAT_PERCENT} % VAT, no transfer or margin; with resolution=hour the hour's average`,
    example: 5.23,
  })
  price: number;

  @ApiProperty({
    description: CATEGORY_DESCRIPTION,
    enum: PriceCategory,
    example: PriceCategory.NORMAL,
  })
  category: PriceCategory;
}

export class PricesMetaDto {
  @ApiProperty({ description: 'Unit of every price', example: 'c/kWh' })
  unit: 'c/kWh';

  @ApiProperty({ description: 'Whether prices include VAT', example: true })
  vatIncluded: boolean;

  @ApiProperty({ description: 'VAT included, in percent', example: 25.5 })
  vatPercent: number;

  @ApiProperty({ description: 'Bidding zone', example: 'FI' })
  area: 'FI';

  @ApiProperty({
    description: 'Length of each price',
    enum: RESOLUTIONS,
    example: '15min',
  })
  resolution: Resolution;

  @ApiProperty({
    description: 'End of the last published price (ISO 8601, UTC)',
    example: '2026-10-13T21:00:00.000Z',
  })
  pricesUntil: string;

  @ApiProperty({
    description:
      "Whether tomorrow's prices (Finnish day) are published. They usually are from about 14:00 Finnish time.",
    example: true,
  })
  tomorrowPublished: boolean;
}

export class PricesDto {
  @ApiProperty({
    description:
      'The price now: this quarter, or this hour with resolution=hour',
    type: PriceDto,
  })
  current: PriceDto;

  @ApiProperty({
    description: 'Prices from `from` to `to`, in time order',
    type: [PriceDto],
  })
  prices: PriceDto[];

  @ApiProperty({ type: PricesMetaDto })
  meta: PricesMetaDto;
}

export class PriceNowDto extends PriceDto {
  @ApiProperty({ type: PricesMetaDto })
  meta: PricesMetaDto;
}
