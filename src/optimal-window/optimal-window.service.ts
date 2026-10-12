import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import {
  HOUR_MS,
  byStartTime,
  quarterStart,
  round2,
} from '../pricing/price-point';
import {
  PriceWindow,
  cheapestWindows,
  pickNonOverlapping,
  windowAt,
} from '../pricing/windows';
import { Clock, systemClock } from '../shared/clock/clock';
import { toOptimalTimeDto } from '../shared/dto/optimal-time.mapper';
import { ElectricityPriceService } from '../shared/electricity-price/electricity-price.service';
import {
  DEFAULT_WINDOW_COUNT,
  OptimalWindowRequestDto,
} from './dto/optimal-window-request.dto';
import {
  OptimalWindowsDto,
  StartOffsetWindowDto,
  WindowDto,
} from './dto/optimal-window.dto';

@Injectable()
export class OptimalWindowService {
  constructor(
    private readonly electricityPriceService: ElectricityPriceService,
    @Optional() private readonly clock: Clock = systemClock,
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

    const prices = await this.electricityPriceService.getUpcomingPrices();
    const currentQuarter = quarterStart(this.clock.now());
    const lastPriceEnd = prices.length
      ? Date.parse(prices[prices.length - 1].endTime)
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
        Date.parse(price.startTime) >= earliestStart &&
        Date.parse(price.endTime) <= latestEnd,
    );
    const byStart = byStartTime(prices);
    const startNow = windowAt(byStart, currentQuarter, quarters);
    const toWindow = (window: PriceWindow): WindowDto =>
      this.toWindow(window, request.energyKwh, startNow);

    return {
      durationHours: request.durationHours,
      ...(request.energyKwh !== undefined && {
        energyKwh: request.energyKwh,
      }),
      earliestStart: new Date(earliestStart).toISOString(),
      latestEnd: new Date(latestEnd).toISOString(),
      ...(startNow && { startNow: toWindow(startNow) }),
      windows: pickNonOverlapping(
        cheapestWindows(searched, quarters),
        request.count ?? DEFAULT_WINDOW_COUNT,
      ).map(toWindow),
      ...((request.startOffsetsHours || request.startEveryFullHour) && {
        startOffsets: this.startOffsets(request, currentQuarter, lastPriceEnd)
          .sort((a, b) => a - b)
          .flatMap((offsetHours): StartOffsetWindowDto[] => {
            const window = windowAt(
              byStart,
              currentQuarter + offsetHours * HOUR_MS,
              quarters,
            );
            return window ? [{ offsetHours, ...toWindow(window) }] : [];
          }),
      }),
    };
  }

  /**
   * The requested offsets and, with startEveryFullHour, the offset of every
   * full hour from the next one up to the last start whose window can fit
   * before the last published price ends.
   */
  private startOffsets(
    request: OptimalWindowRequestDto,
    currentQuarter: number,
    lastPriceEnd: number,
  ): number[] {
    const offsets = new Set(request.startOffsetsHours ?? []);
    if (request.startEveryFullHour) {
      const lastStart = lastPriceEnd - request.durationHours * HOUR_MS;
      for (
        let start = Math.ceil((currentQuarter + 1) / HOUR_MS) * HOUR_MS;
        start <= lastStart;
        start += HOUR_MS
      ) {
        offsets.add((start - currentQuarter) / HOUR_MS);
      }
    }
    return [...offsets];
  }

  /** Costs use the unrounded average; only the output is rounded */
  private toWindow(
    window: PriceWindow,
    energyKwh: number | undefined,
    startNow: PriceWindow | undefined,
  ): WindowDto {
    const dto = toOptimalTimeDto(window);
    if (energyKwh === undefined) return dto;
    const cost = window.priceAvg * energyKwh;
    return {
      ...dto,
      costCents: round2(cost),
      ...(startNow && {
        savingsCents: round2(startNow.priceAvg * energyKwh - cost),
      }),
    };
  }
}
