import { BadRequestException, Injectable } from '@nestjs/common';
import { ElectricityPriceDto } from '../shared/electricity-price/dto/electricity-price.dto';
import { ElectricityPriceService } from '../shared/electricity-price/electricity-price.service';
import {
  OptimalPeriodResult,
  findOptimalPeriod,
} from '../shared/electricity-price/utils/find-optimal-period.helper';
import {
  DEFAULT_WINDOW_COUNT,
  OptimalWindowRequestDto,
} from './dto/optimal-window-request.dto';
import {
  OptimalWindowsDto,
  StartOffsetWindowDto,
  WindowDto,
} from './dto/optimal-window.dto';

const QUARTER_MS = 15 * 60 * 1000;

const round2 = (value: number): number => Math.round(value * 100) / 100;

@Injectable()
export class OptimalWindowService {
  constructor(
    private readonly electricityPriceService: ElectricityPriceService,
  ) {}

  /**
   * The cheapest non-overlapping windows of the requested length between
   * earliestStart and latestEnd, cheapest first.
   */
  async findWindows(
    request: OptimalWindowRequestDto,
  ): Promise<OptimalWindowsDto> {
    const quarters = request.durationHours * 4;
    if (!Number.isInteger(quarters)) {
      throw new BadRequestException(
        'durationHours must be a multiple of 0.25 (15 minutes)',
      );
    }
    if (
      request.startOffsetsHours?.some((offset) => !Number.isInteger(offset * 4))
    ) {
      throw new BadRequestException(
        'startOffsetsHours must be multiples of 0.25 (15 minutes)',
      );
    }

    const prices = await this.getUpcomingPrices();
    const currentQuarter = Math.floor(Date.now() / QUARTER_MS) * QUARTER_MS;
    const lastPriceEnd = prices.length
      ? Date.parse(prices[prices.length - 1].endDate)
      : currentQuarter;

    const earliestStart = Math.max(
      currentQuarter,
      request.earliestStart ? Date.parse(request.earliestStart) : 0,
    );
    const latestEnd = request.latestEnd
      ? Date.parse(request.latestEnd)
      : lastPriceEnd;
    if (latestEnd <= earliestStart) {
      throw new BadRequestException('latestEnd must be after earliestStart');
    }

    const searched = prices.filter(
      (price) =>
        Date.parse(price.startDate) >= earliestStart &&
        Date.parse(price.endDate) <= latestEnd,
    );
    const candidates = findOptimalPeriod(
      searched,
      request.durationHours,
      Infinity,
    );

    const nowPrices = prices.slice(0, quarters);
    const startNow =
      nowPrices.length === quarters
        ? findOptimalPeriod(nowPrices, request.durationHours, 1)[0]
        : undefined;
    const toWindow = (period: OptimalPeriodResult): WindowDto =>
      this.toWindow(period, request.energyKwh, startNow);

    return {
      durationHours: request.durationHours,
      ...(request.energyKwh !== undefined && {
        energyKwh: request.energyKwh,
      }),
      earliestStart: new Date(earliestStart).toISOString(),
      latestEnd: new Date(latestEnd).toISOString(),
      ...(startNow && { startNow: toWindow(startNow) }),
      windows: this.pickNonOverlapping(
        candidates,
        request.count ?? DEFAULT_WINDOW_COUNT,
      ).map(toWindow),
      ...(request.startOffsetsHours && {
        startOffsets: this.offsetWindows(
          prices,
          currentQuarter,
          request.durationHours,
          request.startOffsetsHours,
        ).map(({ offsetHours, period }): StartOffsetWindowDto => ({
          offsetHours,
          ...toWindow(period),
        })),
      }),
    };
  }

  /**
   * The window starting at each offset from the current quarter. Prices are
   * looked up by start time, so a missing quarter only drops the offsets
   * whose window overlaps it.
   */
  private offsetWindows(
    prices: ElectricityPriceDto[],
    currentQuarter: number,
    durationHours: number,
    offsetsHours: number[],
  ): { offsetHours: number; period: OptimalPeriodResult }[] {
    const byStart = new Map(
      prices.map((price) => [Date.parse(price.startDate), price]),
    );
    return [...offsetsHours]
      .sort((a, b) => a - b)
      .flatMap((offsetHours) => {
        const start = currentQuarter + offsetHours * 4 * QUARTER_MS;
        const slot = Array.from({ length: durationHours * 4 }, (_, q) =>
          byStart.get(start + q * QUARTER_MS),
        );
        if (slot.some((price) => !price)) return [];
        const [period] = findOptimalPeriod(slot, durationHours, 1);
        return period ? [{ offsetHours, period }] : [];
      });
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

  /**
   * Candidates come cheapest first (earlier first on a tie), so taking
   * each one that does not overlap an already taken window gives the
   * cheapest set.
   */
  private pickNonOverlapping(
    candidates: OptimalPeriodResult[],
    count: number,
  ): OptimalPeriodResult[] {
    const picked: OptimalPeriodResult[] = [];
    for (const candidate of candidates) {
      if (picked.length === count) break;
      const overlaps = picked.some(
        (window) =>
          candidate.startTime < window.endTime &&
          window.startTime < candidate.endTime,
      );
      if (!overlaps) picked.push(candidate);
    }
    return picked;
  }

  private toWindow(
    period: OptimalPeriodResult,
    energyKwh: number | undefined,
    startNow: OptimalPeriodResult | undefined,
  ): WindowDto {
    if (energyKwh === undefined) return { ...period };
    const costCents = round2(period.priceAvg * energyKwh);
    return {
      ...period,
      costCents,
      ...(startNow && {
        savingsCents: round2(startNow.priceAvg * energyKwh - costCents),
      }),
    };
  }
}
