import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import {
  PricePoint,
  QUARTER_MS,
  byStartTime,
  quarterStart,
  round2,
} from '../pricing/price-point';
import {
  SlotEnergy,
  planCheapestSchedule,
  quarterKwh,
  slotsNeeded,
} from '../pricing/schedule';
import { Clock, systemClock } from '../shared/clock/clock';
import { ElectricityPriceService } from '../shared/electricity-price/electricity-price.service';
import { OptimalScheduleRequestDto } from './dto/optimal-schedule-request.dto';
import {
  OptimalScheduleDto,
  ScheduleBlockDto,
} from './dto/optimal-schedule.dto';

/** A run of slots drawing energy, cost in cents not rounded */
interface ScheduleRun {
  startTime: string;
  endTime: string;
  energyKwh: number;
  cost: number;
}
const hours = (ms: number): string => `${round2(ms / (4 * QUARTER_MS))} h`;

@Injectable()
export class OptimalScheduleService {
  constructor(
    private readonly electricityPriceService: ElectricityPriceService,
    @Optional() private readonly clock: Clock = systemClock,
  ) {}

  /**
   * The cheapest 15-minute slots to draw the energy in between the earliest
   * start and the deadline, grouped into blocks.
   */
  async findSchedule(
    request: OptimalScheduleRequestDto,
  ): Promise<OptimalScheduleDto> {
    const options = request.options ?? {};
    const minConsecutiveHours = options.minConsecutiveHours ?? 0.25;
    const minBlockSlots = minConsecutiveHours * 4;
    if (!Number.isInteger(minBlockSlots)) {
      throw new BadRequestException(
        'options.minConsecutiveHours must be a multiple of 0.25 (15 minutes)',
      );
    }

    const prices = await this.electricityPriceService.getUpcomingPrices();
    const currentQuarter = quarterStart(this.clock.now());
    const pricesUntil = prices.length
      ? Date.parse(prices[prices.length - 1].endTime)
      : currentQuarter;

    const earliestStart = Math.max(
      currentQuarter,
      options.earliestStart ? Date.parse(options.earliestStart) : 0,
    );
    const requestedDeadline = options.deadlineAt
      ? Date.parse(options.deadlineAt)
      : pricesUntil;
    if (requestedDeadline <= earliestStart) {
      throw new BadRequestException(
        'options.deadlineAt must be after now and options.earliestStart',
      );
    }
    const deadlineAt = Math.min(requestedDeadline, pricesUntil);

    const searched = prices.filter(
      (price) =>
        Date.parse(price.startTime) >= earliestStart &&
        Date.parse(price.endTime) <= deadlineAt,
    );
    const energy = planCheapestSchedule(
      searched,
      request.energyKwh,
      request.maxPowerKw,
      minBlockSlots,
    );
    if (!energy) {
      const { count } = slotsNeeded(request.energyKwh, request.maxPowerKw);
      const pricesNote =
        requestedDeadline > pricesUntil
          ? ` Prices are published only until ${new Date(pricesUntil).toISOString()}.`
          : '';
      throw new BadRequestException(
        `${request.energyKwh} kWh at ${request.maxPowerKw} kW takes ${hours(count * QUARTER_MS)}, which does not fit in the ${hours(searched.length * QUARTER_MS)} of prices between ${new Date(earliestStart).toISOString()} and ${new Date(deadlineAt).toISOString()} with blocks of at least ${minConsecutiveHours} h.${pricesNote}`,
      );
    }

    const runs = this.toRuns(searched, energy, request.maxPowerKw);
    const cost = runs.reduce((sum, run) => sum + run.cost, 0);
    const startRightAway = this.startRightAway(
      prices,
      earliestStart,
      request.energyKwh,
      request.maxPowerKw,
    );

    return {
      energyKwh: request.energyKwh,
      maxPowerKw: request.maxPowerKw,
      earliestStart: new Date(earliestStart).toISOString(),
      deadlineAt: new Date(deadlineAt).toISOString(),
      minConsecutiveHours,
      pricesUntil: new Date(pricesUntil).toISOString(),
      costCents: round2(cost),
      priceAvg: round2(cost / request.energyKwh),
      blocks: runs.map((run): ScheduleBlockDto => ({
        startTime: run.startTime,
        endTime: run.endTime,
        energyKwh: round2(run.energyKwh),
        costCents: round2(run.cost),
        priceAvg: round2(run.cost / run.energyKwh),
      })),
      ...(startRightAway && {
        startRightAway: {
          startTime: startRightAway.startTime,
          endTime: startRightAway.endTime,
          costCents: round2(startRightAway.cost),
          priceAvg: round2(startRightAway.cost / request.energyKwh),
        },
        savingsCents: round2(startRightAway.cost - cost),
      }),
    };
  }

  /**
   * Slots that draw energy, grouped into runs of consecutive slots. The
   * device runs at maxPowerKw from the start of a run until the run's
   * energy is in, so a run's top-up comes in its last slot.
   */
  private toRuns(
    prices: PricePoint[],
    energy: SlotEnergy,
    maxPowerKw: number,
  ): ScheduleRun[] {
    const runs: number[][] = [];
    energy.forEach((kwh, i) => {
      if (!kwh) return;
      const run = runs[runs.length - 1];
      const previous = run?.[run.length - 1];
      if (
        previous === i - 1 &&
        prices[previous].endTime === prices[i].startTime
      ) {
        run.push(i);
      } else {
        runs.push([i]);
      }
    });
    return runs.map((run) => {
      const energyKwh = run.reduce((sum, i) => sum + energy[i], 0);
      let left = energyKwh;
      let cost = 0;
      for (const i of run) {
        const kwh = Math.min(left, quarterKwh(maxPowerKw));
        cost += prices[i].price * kwh;
        left -= kwh;
      }
      return {
        startTime: prices[run[0]].startTime,
        endTime: prices[run[run.length - 1]].endTime,
        energyKwh,
        cost,
      };
    });
  }

  /**
   * Drawing maxPowerKw from earliestStart until the energy is in, the last
   * slot topping up the rest. Undefined when a price is missing on the way.
   */
  private startRightAway(
    prices: PricePoint[],
    earliestStart: number,
    energyKwh: number,
    maxPowerKw: number,
  ): Omit<ScheduleRun, 'energyKwh'> | undefined {
    const { count, lastKwh } = slotsNeeded(energyKwh, maxPowerKw);
    const byStart = byStartTime(prices);
    let cost = 0;
    for (let q = 0; q < count; q++) {
      const price = byStart.get(earliestStart + q * QUARTER_MS);
      if (!price) return undefined;
      const kwh = q === count - 1 ? lastKwh : quarterKwh(maxPowerKw);
      cost += price.price * kwh;
    }
    return {
      startTime: new Date(earliestStart).toISOString(),
      endTime: new Date(earliestStart + count * QUARTER_MS).toISOString(),
      cost,
    };
  }
}
