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
    description: `Price in c/kWh including ${VAT_PERCENT} % VAT (without it with vat=false), no transfer or margin; with resolution=hour the hour's average`,
    example: 5.23,
  })
  price: number;

  @ApiProperty({
    description: `${CATEGORY_DESCRIPTION}, judged on the price with VAT`,
    enum: PriceCategory,
    example: PriceCategory.NORMAL,
  })
  category: PriceCategory;

  @ApiProperty({
    description:
      "The price among its own Finnish day's prices: the cheapest fifth of the day is VERY_CHEAP, the dearest fifth VERY_EXPENSIVE. Always marks some hours cheap, for automations that run in the day's cheapest hours.",
    enum: PriceCategory,
    example: PriceCategory.CHEAP,
  })
  dayCategory: PriceCategory;
}

export class PricesMetaDto {
  @ApiProperty({ description: 'Unit of every price', example: 'c/kWh' })
  unit: 'c/kWh';

  @ApiProperty({
    description: 'Whether prices include VAT (vat=false leaves it out)',
    example: true,
  })
  vatIncluded: boolean;

  @ApiProperty({
    description: 'VAT included, in percent: 0 with vat=false',
    example: 25.5,
  })
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

  @ApiProperty({
    description:
      "When the next day's prices are expected, at about 14:00 Finnish time (ISO 8601, UTC): today until tomorrow's are in, then tomorrow. In the past while they are late.",
    example: '2026-10-13T11:00:00.000Z',
  })
  nextPricesExpectedAt: string;

  @ApiProperty({
    description:
      'Where the prices came from: ENTSO-E, or spot-hinta.fi as the fallback',
    example: 'ENTSO-E',
    required: false,
  })
  source?: string;

  @ApiProperty({
    description: 'When the prices were fetched from the source (ISO 8601, UTC)',
    example: '2026-10-12T11:02:13.000Z',
    required: false,
  })
  fetchedAt?: string;
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
