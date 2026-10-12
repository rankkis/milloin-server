import { ApiProperty } from '@nestjs/swagger';
import { PriceCategory } from '../../../pricing/price-category';
import { VAT_PERCENT } from '../../../pricing/vat';

export class PlanBlockDto {
  @ApiProperty({
    description: 'When to switch on (ISO 8601, UTC)',
    example: '2026-10-13T00:00:00.000Z',
  })
  startTime: string;

  @ApiProperty({
    description:
      'When to switch off (ISO 8601, UTC). At full power the energy may be in up to 15 minutes earlier.',
    example: '2026-10-13T02:00:00.000Z',
  })
  endTime: string;

  @ApiProperty({
    description: 'Energy drawn in the block (kWh). Only when energy is known.',
    example: 22,
    required: false,
  })
  energyKwh?: number;
}

export class PlanCostDto {
  @ApiProperty({
    description: 'Start (ISO 8601, UTC)',
    example: '2026-10-13T00:00:00.000Z',
  })
  startTime: string;

  @ApiProperty({
    description: 'End of the last block (ISO 8601, UTC)',
    example: '2026-10-13T02:00:00.000Z',
  })
  endTime: string;

  @ApiProperty({
    description:
      'Average price of the energy in c/kWh; with no energy given, the average of the prices',
    example: 2.15,
  })
  priceAvg: number;

  @ApiProperty({ enum: PriceCategory, example: PriceCategory.VERY_CHEAP })
  category: PriceCategory;

  @ApiProperty({
    description:
      'Cost of the energy in cents (VAT included, no transfer or margin). Only when energy is known.',
    example: 47.3,
    required: false,
  })
  costCents?: number;
}

export class PlanDto extends PlanCostDto {
  @ApiProperty({
    description:
      'Cents saved compared with startNow; negative when this plan costs more. Only when energy is known and startNow is given.',
    example: 120.4,
    required: false,
  })
  savingsCents?: number;

  @ApiProperty({
    description: 'Whether one of the blocks is running now',
    example: false,
  })
  activeNow: boolean;

  @ApiProperty({
    description:
      'When to switch next (ISO 8601, UTC): the end of the running block, or the start of the next one. Left out once the plan is over.',
    example: '2026-10-13T00:00:00.000Z',
    required: false,
  })
  nextChangeAt?: string;

  @ApiProperty({
    description:
      'When to run, in time order: one block for a continuous load, one or more for a pausable one',
    type: [PlanBlockDto],
  })
  blocks: PlanBlockDto[];
}

export class StartTimePlanDto extends PlanCostDto {
  @ApiProperty({
    description: 'The start time as requested',
    example: '2026-10-12T16:00:00Z',
  })
  requestedStart: string;
}

export class ResolvedPlanRequestDto {
  @ApiProperty({ example: false })
  pausable: boolean;

  @ApiProperty({
    description: 'Time on in hours',
    example: 2,
  })
  durationHours: number;

  @ApiProperty({ example: 1.5, required: false })
  energyKwh?: number;

  @ApiProperty({ example: 11, required: false })
  maxPowerKw?: number;

  @ApiProperty({
    description: 'Pausable loads only',
    example: 0.25,
    required: false,
  })
  minBlockHours?: number;

  @ApiProperty({
    description: 'Start of the search (ISO 8601, UTC)',
    example: '2026-10-12T07:45:00.000Z',
  })
  earliestStart: string;

  @ApiProperty({
    description:
      'End of the search (ISO 8601, UTC): the requested latestEnd or meta.pricesUntil, whichever is earlier',
    example: '2026-10-13T21:00:00.000Z',
  })
  latestEnd: string;

  @ApiProperty({ example: 3 })
  limit: number;

  @ApiProperty({
    description: 'The preset used, if any',
    example: 'laundry',
    required: false,
  })
  preset?: string;
}

export class PlansMetaDto {
  @ApiProperty({ description: 'Unit of priceAvg', example: 'c/kWh' })
  priceUnit: 'c/kWh';

  @ApiProperty({ description: 'Currency of the *Cents fields', example: 'EUR' })
  currency: 'EUR';

  @ApiProperty({ example: true })
  vatIncluded: boolean;

  @ApiProperty({ example: VAT_PERCENT })
  vatPercent: number;

  @ApiProperty({ example: 'FI' })
  area: 'FI';

  @ApiProperty({
    description:
      "End of the last published price (ISO 8601, UTC). Tomorrow's prices come at about 14:00 Finnish time, after which a later latestEnd may give a cheaper plan.",
    example: '2026-10-13T21:00:00.000Z',
  })
  pricesUntil: string;
}

export class PlansDto {
  @ApiProperty({
    description: 'The request with defaults filled in',
    type: ResolvedPlanRequestDto,
  })
  request: ResolvedPlanRequestDto;

  @ApiProperty({ type: PlansMetaDto })
  meta: PlansMetaDto;

  @ApiProperty({
    description:
      'Whether the cheapest plan is running now: the same as plans[0].activeNow, false without plans',
    example: false,
  })
  activeNow: boolean;

  @ApiProperty({
    description: "The cheapest plan's next switch (plans[0].nextChangeAt)",
    example: '2026-10-13T00:00:00.000Z',
    required: false,
  })
  nextChangeAt?: string;

  @ApiProperty({
    description:
      'Running continuously from the start of the search, or from now if that is later, for comparison. Left out when the prices do not reach far enough.',
    type: PlanCostDto,
    required: false,
  })
  startNow?: PlanCostDto;

  @ApiProperty({
    description:
      'Cheapest first. Continuous loads: up to limit runs that do not overlap. Pausable loads: the single cheapest plan. Empty when nothing fits between earliestStart and latestEnd.',
    type: [PlanDto],
  })
  plans: PlanDto[];

  @ApiProperty({
    description:
      'POST /v1/plans/search only: the run from each requested start time, in the order given. Starts whose run passes the published prices are left out.',
    type: [StartTimePlanDto],
    required: false,
  })
  startTimes?: StartTimePlanDto[];
}

export class PlanPresetDto {
  @ApiProperty({ example: 'ev-charging' })
  name: string;

  @ApiProperty({ example: 'Charging an electric vehicle at 11 kW' })
  description: string;

  @ApiProperty({ example: true })
  pausable: boolean;

  @ApiProperty({ example: 4, required: false })
  durationHours?: number;

  @ApiProperty({ example: 44 })
  energyKwh: number;

  @ApiProperty({ example: 11, required: false })
  maxPowerKw?: number;

  @ApiProperty({ example: 1, required: false })
  minBlockHours?: number;
}
