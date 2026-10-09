import { BadRequestException, Injectable } from '@nestjs/common';
import { ElectricityPriceDto } from '../shared/electricity-price/dto/electricity-price.dto';
import { ElectricityPriceService } from '../shared/electricity-price/electricity-price.service';
import { OptimalScheduleRequestDto } from './dto/optimal-schedule-request.dto';
import {
  OptimalScheduleDto,
  ScheduleBlockDto,
  ScheduleComparisonDto,
} from './dto/optimal-schedule.dto';
import {
  SlotEnergy,
  planCheapestSchedule,
  quarterKwh,
  slotsNeeded,
} from './plan-schedule.helper';

const QUARTER_MS = 15 * 60 * 1000;

const round2 = (value: number): number => Math.round(value * 100) / 100;
const hours = (ms: number): string => `${round2(ms / (4 * QUARTER_MS))} h`;

@Injectable()
export class OptimalScheduleService {
  constructor(
    private readonly electricityPriceService: ElectricityPriceService,
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

    const prices = await this.getUpcomingPrices();
    const currentQuarter = Math.floor(Date.now() / QUARTER_MS) * QUARTER_MS;
    const pricesUntil = prices.length
      ? Date.parse(prices[prices.length - 1].endDate)
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
        Date.parse(price.startDate) >= earliestStart &&
        Date.parse(price.endDate) <= deadlineAt,
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

    const blocks = this.toBlocks(searched, energy, request.maxPowerKw);
    const costCents = round2(
      blocks.reduce((sum, block) => sum + block.costCents, 0),
    );
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
      costCents,
      priceAvg: round2(costCents / request.energyKwh),
      blocks,
      ...(startRightAway && {
        startRightAway,
        savingsCents: round2(startRightAway.costCents - costCents),
      }),
    };
  }

  /**
   * Slots that draw energy, grouped into runs of consecutive slots. The
   * device runs at maxPowerKw from the start of a block until the block's
   * energy is in, so a block's top-up comes in its last slot.
   */
  private toBlocks(
    prices: ElectricityPriceDto[],
    energy: SlotEnergy,
    maxPowerKw: number,
  ): ScheduleBlockDto[] {
    const runs: number[][] = [];
    energy.forEach((kwh, i) => {
      if (!kwh) return;
      const run = runs[runs.length - 1];
      const previous = run?.[run.length - 1];
      if (
        previous === i - 1 &&
        prices[previous].endDate === prices[i].startDate
      ) {
        run.push(i);
      } else {
        runs.push([i]);
      }
    });
    return runs.map((run) => {
      const energyKwh = run.reduce((sum, i) => sum + energy[i], 0);
      let left = energyKwh;
      let costCents = 0;
      for (const i of run) {
        const kwh = Math.min(left, quarterKwh(maxPowerKw));
        costCents += prices[i].price * 100 * kwh;
        left -= kwh;
      }
      return {
        startTime: prices[run[0]].startDate,
        endTime: prices[run[run.length - 1]].endDate,
        energyKwh: round2(energyKwh),
        costCents: round2(costCents),
        priceAvg: round2(costCents / energyKwh),
      };
    });
  }

  /**
   * Drawing maxPowerKw from earliestStart until the energy is in, the last
   * slot topping up the rest. Undefined when a price is missing on the way.
   */
  private startRightAway(
    prices: ElectricityPriceDto[],
    earliestStart: number,
    energyKwh: number,
    maxPowerKw: number,
  ): ScheduleComparisonDto | undefined {
    const { count, lastKwh } = slotsNeeded(energyKwh, maxPowerKw);
    const byStart = new Map(
      prices.map((price) => [Date.parse(price.startDate), price]),
    );
    let costCents = 0;
    for (let q = 0; q < count; q++) {
      const price = byStart.get(earliestStart + q * QUARTER_MS);
      if (!price) return undefined;
      const kwh = q === count - 1 ? lastKwh : quarterKwh(maxPowerKw);
      costCents += price.price * 100 * kwh;
    }
    return {
      startTime: new Date(earliestStart).toISOString(),
      endTime: new Date(earliestStart + count * QUARTER_MS).toISOString(),
      costCents: round2(costCents),
      priceAvg: round2(costCents / energyKwh),
    };
  }

  /** Prices from the current 15-minute interval to the last published one */
  private async getUpcomingPrices(): Promise<ElectricityPriceDto[]> {
    const today = await this.electricityPriceService.getTodayPrices();
    const tomorrow = await this.electricityPriceService
      .getTomorrowPrices()
      .catch((): ElectricityPriceDto[] => []);
    const now = Date.now();
    return [...today, ...tomorrow].filter(
      (price) => Date.parse(price.endDate) > now,
    );
  }
}
