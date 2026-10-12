import { BadRequestException, Injectable } from '@nestjs/common';
import { hourlyPrices } from '../../pricing/hours';
import { priceCategory } from '../../pricing/price-category';
import {
  HOUR_MS,
  PricePoint,
  QUARTER_MS,
  byStartTime,
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
import { VAT_PERCENT, withoutVat } from '../../pricing/vat';
import { Clock } from '../../shared/clock/clock';
import { ElectricityPriceService } from '../../shared/electricity-price/electricity-price.service';
import { startOfHelsinkiDay } from '../../shared/utils/helsinki-time.helper';
import { PlanSearchDto } from './dto/plan-search.dto';
import { DEFAULT_PLAN_LIMIT, MAX_DURATION_HOURS } from './dto/plans-query.dto';
import { PlanCostDto, PlanDto, PlansDto } from './dto/plans.dto';

const isMultiple = (hours: number, slotHours: number): boolean => {
  const slots = hours / slotHours;
  return Math.abs(slots - Math.round(slots)) < 1e-9;
};

/** How the prices are read: slot length and VAT */
interface PriceView {
  slotMs: number;
  vat: boolean;
}

@Injectable()
export class PlansService {
  constructor(
    private readonly electricityPriceService: ElectricityPriceService,
    private readonly clock: Clock,
  ) {}

  async findPlans(input: PlanSearchDto, preset?: string): Promise<PlansDto> {
    const view: PriceView = {
      slotMs: input.resolution === 'hour' ? HOUR_MS : QUARTER_MS,
      vat: input.vat ?? true,
    };
    const pausable = input.pausable ?? false;
    const profile = this.profile(input, pausable, view.slotMs);
    const minBlockHours = pausable
      ? (input.minBlockHours ?? view.slotMs / HOUR_MS)
      : undefined;
    const limit = pausable ? 1 : (input.limit ?? DEFAULT_PLAN_LIMIT);

    const now = this.clock.now();
    const quarters = await this.electricityPriceService.getPrices();
    const prices = this.slots(quarters, view);
    const slotStart = (time: number) =>
      Math.floor(time / view.slotMs) * view.slotMs;
    const currentSlot = slotStart(now);
    const firstPrice = prices.length ? Date.parse(prices[0].startTime) : now;
    const pricesUntil = prices.length
      ? Date.parse(prices[prices.length - 1].endTime)
      : currentSlot;

    const requestedStart = this.time(input.earliestStart, now);
    const requestedEnd = this.time(input.latestEnd, now);
    if (
      requestedStart !== undefined &&
      requestedEnd !== undefined &&
      requestedEnd <= requestedStart
    ) {
      throw new BadRequestException('latestEnd must be after earliestStart');
    }
    // Starts on whole slots, at the earliest where prices begin
    const earliestStart = Math.max(
      firstPrice,
      Math.ceil((requestedStart ?? currentSlot) / view.slotMs) * view.slotMs,
    );
    const latestEnd = Math.max(
      earliestStart,
      slotStart(Math.min(requestedEnd ?? pricesUntil, pricesUntil)),
    );

    const searched = prices.filter(
      (price) =>
        Date.parse(price.startTime) >= earliestStart &&
        Date.parse(price.endTime) <= latestEnd,
    );
    const found = pausable
      ? [
          pausablePlan(
            searched,
            profile,
            Math.round((minBlockHours * HOUR_MS) / view.slotMs),
          ),
        ].filter((plan): plan is Plan => plan !== undefined)
      : continuousPlans(searched, profile, limit);

    const byStart = byStartTime(prices);
    const startNow = runAt(
      byStart,
      Math.max(currentSlot, earliestStart),
      profile,
    );
    const plans = found.map((plan) =>
      this.toPlanDto(plan, profile, view, startNow, now),
    );
    const {
      pricesUntil: until,
      tomorrowPublished,
      nextPricesExpectedAt,
    } = this.electricityPriceService.getFreshness(quarters);

    return {
      request: {
        pausable,
        durationHours: (profile.slotKwh.length * view.slotMs) / HOUR_MS,
        ...(profile.hasEnergy && {
          energyKwh: round2(profile.slotKwh.reduce((a, b) => a + b, 0)),
        }),
        ...(input.maxPowerKw !== undefined && { maxPowerKw: input.maxPowerKw }),
        ...(minBlockHours !== undefined && { minBlockHours }),
        earliestStart: new Date(earliestStart).toISOString(),
        latestEnd: new Date(latestEnd).toISOString(),
        limit,
        resolution: view.slotMs === HOUR_MS ? 'hour' : '15min',
        ...(preset && { preset }),
      },
      meta: {
        priceUnit: 'c/kWh',
        currency: 'EUR',
        vatIncluded: view.vat,
        vatPercent: view.vat ? VAT_PERCENT : 0,
        area: 'FI',
        pricesUntil: until,
        tomorrowPublished,
        nextPricesExpectedAt,
      },
      activeNow: plans[0]?.activeNow ?? false,
      ...(plans[0]?.nextChangeAt && { nextChangeAt: plans[0].nextChangeAt }),
      ...(startNow && { startNow: this.toCostDto(startNow, profile, view) }),
      plans,
      ...(input.startTimes && {
        startTimes: input.startTimes.flatMap((requested) => {
          const run = runAt(byStart, slotStart(Date.parse(requested)), profile);
          return run
            ? [
                {
                  requestedStart: requested,
                  ...this.toCostDto(run, profile, view),
                },
              ]
            : [];
        }),
      }),
    };
  }

  /** The prices as the plan reads them: per slot, with or without VAT */
  private slots(quarters: PricePoint[], view: PriceView): PricePoint[] {
    const slots =
      view.slotMs === HOUR_MS
        ? hourlyPrices(quarters).map((hour) => ({
            startTime: hour.startTime,
            endTime: hour.endTime,
            price: hour.priceAvg,
          }))
        : quarters;
    return view.vat
      ? slots
      : slots.map((price) => ({ ...price, price: withoutVat(price.price) }));
  }

  /** The load's energy per slot, checking the inputs fit together */
  private profile(
    input: PlanSearchDto,
    pausable: boolean,
    slotMs: number,
  ): LoadProfile {
    const slotHours = slotMs / HOUR_MS;
    const slotName =
      slotMs === HOUR_MS ? 'whole hours' : 'a multiple of 0.25 (15 minutes)';
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
      !isMultiple(input.minBlockHours, slotHours)
    ) {
      throw new BadRequestException(`minBlockHours must be ${slotName}`);
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
      return { slotKwh: input.profileKwh, slotMs, hasEnergy: true };
    }
    if (input.durationHours !== undefined) {
      if (input.maxPowerKw !== undefined) {
        throw new BadRequestException(
          'Give durationHours or maxPowerKw, not both',
        );
      }
      if (!isMultiple(input.durationHours, slotHours)) {
        throw new BadRequestException(`durationHours must be ${slotName}`);
      }
      return loadProfile(input, slotMs);
    }
    if (input.energyKwh !== undefined && input.maxPowerKw !== undefined) {
      const profile = loadProfile(input, slotMs);
      if (profile.slotKwh.length * slotHours > MAX_DURATION_HOURS) {
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

  private toCostDto(
    plan: Plan,
    profile: LoadProfile,
    view: PriceView,
  ): PlanCostDto {
    const priceAvg = plan.cost / plan.energyKwh;
    // Categories are judged on the price with VAT
    const withVat = view.vat ? priceAvg : priceAvg * (1 + VAT_PERCENT / 100);
    return {
      startTime: plan.blocks[0].startTime,
      endTime: plan.blocks[plan.blocks.length - 1].endTime,
      priceAvg: round2(priceAvg),
      category: priceCategory(withVat),
      ...(profile.hasEnergy && { costCents: round2(plan.cost) }),
    };
  }

  private toPlanDto(
    plan: Plan,
    profile: LoadProfile,
    view: PriceView,
    startNow: Plan | undefined,
    now: number,
  ): PlanDto {
    return {
      ...this.toCostDto(plan, profile, view),
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
