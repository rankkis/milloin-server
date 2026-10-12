import { BadRequestException, Injectable } from '@nestjs/common';
import { priceCategory } from '../../pricing/price-category';
import {
  PricePoint,
  QUARTER_MS,
  byStartTime,
  quarterStart,
  round2,
} from '../../pricing/price-point';
import {
  LoadProfile,
  Plan,
  continuousPlans,
  loadProfile,
  pausablePlan,
  planState,
  runAt,
} from '../../pricing/plans';
import { VAT_PERCENT } from '../../pricing/vat';
import { Clock } from '../../shared/clock/clock';
import { ElectricityPriceService } from '../../shared/electricity-price/electricity-price.service';
import { startOfHelsinkiDay } from '../../shared/utils/helsinki-time.helper';
import { PlanSearchDto } from './dto/plan-search.dto';
import { DEFAULT_PLAN_LIMIT, MAX_DURATION_HOURS } from './dto/plans-query.dto';
import { PlanCostDto, PlanDto, PlansDto } from './dto/plans.dto';

const isQuarterMultiple = (hours: number): boolean =>
  Math.abs(hours * 4 - Math.round(hours * 4)) < 1e-9;

@Injectable()
export class PlansService {
  constructor(
    private readonly electricityPriceService: ElectricityPriceService,
    private readonly clock: Clock,
  ) {}

  async findPlans(input: PlanSearchDto, preset?: string): Promise<PlansDto> {
    const pausable = input.pausable ?? false;
    const profile = this.profile(input, pausable);
    const minBlockHours = pausable ? (input.minBlockHours ?? 0.25) : undefined;
    const limit = pausable ? 1 : (input.limit ?? DEFAULT_PLAN_LIMIT);

    const now = this.clock.now();
    const prices = await this.electricityPriceService.getPrices();
    const currentQuarter = quarterStart(now);
    const firstPrice = prices.length ? Date.parse(prices[0].startTime) : now;
    const pricesUntil = prices.length
      ? Date.parse(prices[prices.length - 1].endTime)
      : currentQuarter;

    const requestedStart = this.time(input.earliestStart, now);
    const requestedEnd = this.time(input.latestEnd, now);
    if (
      requestedStart !== undefined &&
      requestedEnd !== undefined &&
      requestedEnd <= requestedStart
    ) {
      throw new BadRequestException('latestEnd must be after earliestStart');
    }
    // Starts at whole quarters, at the earliest where prices begin
    const earliestStart = Math.max(
      firstPrice,
      Math.ceil((requestedStart ?? currentQuarter) / QUARTER_MS) * QUARTER_MS,
    );
    const latestEnd = Math.max(
      earliestStart,
      Math.floor(
        Math.min(requestedEnd ?? pricesUntil, pricesUntil) / QUARTER_MS,
      ) * QUARTER_MS,
    );

    const searched = prices.filter(
      (price) =>
        Date.parse(price.startTime) >= earliestStart &&
        Date.parse(price.endTime) <= latestEnd,
    );
    const found = pausable
      ? [pausablePlan(searched, profile, Math.round(minBlockHours * 4))].filter(
          (plan): plan is Plan => plan !== undefined,
        )
      : continuousPlans(searched, profile, limit);

    const byStart = byStartTime(prices);
    const startNow = runAt(
      byStart,
      Math.max(currentQuarter, earliestStart),
      profile,
    );
    const plans = found.map((plan) =>
      this.toPlanDto(plan, profile, startNow, now),
    );

    return {
      request: {
        pausable,
        durationHours: profile.slotKwh.length / 4,
        ...(profile.hasEnergy && {
          energyKwh: round2(profile.slotKwh.reduce((a, b) => a + b, 0)),
        }),
        ...(input.maxPowerKw !== undefined && { maxPowerKw: input.maxPowerKw }),
        ...(minBlockHours !== undefined && { minBlockHours }),
        earliestStart: new Date(earliestStart).toISOString(),
        latestEnd: new Date(latestEnd).toISOString(),
        limit,
        ...(preset && { preset }),
      },
      meta: {
        priceUnit: 'c/kWh',
        currency: 'EUR',
        vatIncluded: true,
        vatPercent: VAT_PERCENT,
        area: 'FI',
        ...this.freshness(prices),
      },
      activeNow: plans[0]?.activeNow ?? false,
      ...(plans[0]?.nextChangeAt && { nextChangeAt: plans[0].nextChangeAt }),
      ...(startNow && { startNow: this.toCostDto(startNow, profile) }),
      plans,
      ...(input.startTimes && {
        startTimes: input.startTimes.flatMap((requested) => {
          const run = runAt(
            byStart,
            quarterStart(Date.parse(requested)),
            profile,
          );
          return run
            ? [{ requestedStart: requested, ...this.toCostDto(run, profile) }]
            : [];
        }),
      }),
    };
  }

  private freshness(prices: PricePoint[]) {
    const { pricesUntil, tomorrowPublished, nextPricesExpectedAt } =
      this.electricityPriceService.getFreshness(prices);
    return { pricesUntil, tomorrowPublished, nextPricesExpectedAt };
  }

  /** The load's energy per 15-minute slot, checking the inputs fit together */
  private profile(input: PlanSearchDto, pausable: boolean): LoadProfile {
    if (pausable && (input.profileKwh || input.startTimes)) {
      throw new BadRequestException(
        'profileKwh and startTimes are for continuous loads (pausable=false)',
      );
    }
    if (!pausable && input.minBlockHours !== undefined) {
      throw new BadRequestException(
        'minBlockHours is for pausable loads (pausable=true)',
      );
    }
    if (
      input.minBlockHours !== undefined &&
      !isQuarterMultiple(input.minBlockHours)
    ) {
      throw new BadRequestException(
        'minBlockHours must be a multiple of 0.25 (15 minutes)',
      );
    }

    if (input.profileKwh) {
      if (
        input.durationHours !== undefined ||
        input.energyKwh !== undefined ||
        input.maxPowerKw !== undefined
      ) {
        throw new BadRequestException(
          'profileKwh replaces durationHours, energyKwh and maxPowerKw',
        );
      }
      if (!input.profileKwh.some((kwh) => kwh > 0)) {
        throw new BadRequestException('profileKwh must draw some energy');
      }
      return { slotKwh: input.profileKwh, hasEnergy: true };
    }
    if (input.durationHours !== undefined) {
      if (input.maxPowerKw !== undefined) {
        throw new BadRequestException(
          'Give durationHours or maxPowerKw, not both',
        );
      }
      if (!isQuarterMultiple(input.durationHours)) {
        throw new BadRequestException(
          'durationHours must be a multiple of 0.25 (15 minutes)',
        );
      }
      return loadProfile(input);
    }
    if (input.energyKwh !== undefined && input.maxPowerKw !== undefined) {
      const profile = loadProfile(input);
      if (profile.slotKwh.length > MAX_DURATION_HOURS * 4) {
        throw new BadRequestException(
          `${input.energyKwh} kWh at ${input.maxPowerKw} kW takes over ${MAX_DURATION_HOURS} hours`,
        );
      }
      return profile;
    }
    throw new BadRequestException(
      'Give durationHours, or energyKwh with maxPowerKw',
    );
  }

  /** An ISO time or a day keyword, as epoch milliseconds */
  private time(value: string | undefined, now: number): number | undefined {
    if (value === undefined) return undefined;
    if (value === 'today') return startOfHelsinkiDay(new Date(now)).getTime();
    if (value === 'tomorrow')
      return startOfHelsinkiDay(new Date(now), 1).getTime();
    return Date.parse(value);
  }

  private toCostDto(plan: Plan, profile: LoadProfile): PlanCostDto {
    const priceAvg = plan.cost / plan.energyKwh;
    return {
      startTime: plan.blocks[0].startTime,
      endTime: plan.blocks[plan.blocks.length - 1].endTime,
      priceAvg: round2(priceAvg),
      category: priceCategory(priceAvg),
      ...(profile.hasEnergy && { costCents: round2(plan.cost) }),
    };
  }

  private toPlanDto(
    plan: Plan,
    profile: LoadProfile,
    startNow: Plan | undefined,
    now: number,
  ): PlanDto {
    return {
      ...this.toCostDto(plan, profile),
      ...(profile.hasEnergy &&
        startNow && { savingsCents: round2(startNow.cost - plan.cost) }),
      ...planState(plan, now),
      blocks: plan.blocks.map((block) => ({
        startTime: block.startTime,
        endTime: block.endTime,
        ...(profile.hasEnergy && { energyKwh: round2(block.energyKwh) }),
      })),
    };
  }
}
