import { Injectable } from '@nestjs/common';
import { TARIFF_CONFIG } from '../shared/config/tariff.config';
import { OptimalTimeDto } from '../shared/dto/optimal-time.dto';
import { ElectricityPriceDto } from '../shared/electricity-price/dto/electricity-price.dto';
import { ElectricityPriceService } from '../shared/electricity-price/electricity-price.service';
import { findOptimalPeriod } from '../shared/electricity-price/utils/find-optimal-period.helper';
import { WashLaundryForecastDto } from './dto/wash-laundry-forecast.dto';
import { StartDelayDto } from './dto/start-delay.dto';

/** Electricity used by one wash (kWh) */
export const WASH_ENERGY_KWH = 1.5;
/** Timer delays offered to the user: now and +1 … +5 hours */
const MAX_START_DELAY_HOURS = 5;
const QUARTER_MS = 15 * 60 * 1000;
const HOUR_MS = 4 * QUARTER_MS;

// Re-export DTOs for backwards compatibility
export type WashLaundryForecast = WashLaundryForecastDto;
export type OptimalTime = OptimalTimeDto;

@Injectable()
export class WashLaundryService {
  constructor(
    private readonly electricityPriceService: ElectricityPriceService,
  ) {}

  async getOptimalSchedule(): Promise<WashLaundryForecast> {
    const washingDurationHours = 2; // Typical washing machine cycle
    const intervalsNeeded = washingDurationHours * 4; // 15-minute intervals

    // Get price data for today and tomorrow
    const todayPrices = await this.electricityPriceService.getTodayPrices();
    let tomorrowPrices: ElectricityPriceDto[] = [];

    try {
      tomorrowPrices = await this.electricityPriceService.getTomorrowPrices();
    } catch (error) {
      console.warn("Tomorrow's prices not available yet");
      console.warn('Error details:', error.message);
    }

    // Get current time in Finnish timezone
    const now = new Date();
    const finnishTime = this.convertToFinnishTime(now);
    const isCurrentlyDaytime = this.isDaytime(finnishTime);

    // Separate periods for today, tonight, and tomorrow
    const todayDayPrices = this.filterTodayDayPrices(todayPrices, now);
    const tonightPrices = this.filterTonightPrices(
      todayPrices,
      tomorrowPrices,
      now,
    );
    const tomorrowDayPrices = this.filterTomorrowDayPrices(tomorrowPrices, now);

    // Get prices for "starting now" comparison (first N hours from current time, regardless of day/night)
    const allFuturePrices = [...todayPrices, ...tomorrowPrices].filter(
      (price) => new Date(price.endDate) > now,
    );
    const startingNowPrices = allFuturePrices.slice(0, intervalsNeeded);
    const startDelays = this.calculateStartDelays(
      allFuturePrices,
      washingDurationHours,
    );

    // Calculate "now" optimal time (what it costs to start right now)
    let nowOptimal: OptimalTimeDto | null = null;
    if (startingNowPrices.length >= intervalsNeeded) {
      const nowOptimalResult = findOptimalPeriod(
        startingNowPrices,
        washingDurationHours,
        1,
      );
      if (nowOptimalResult.length > 0) {
        nowOptimal = nowOptimalResult[0];
      }
    }

    // Calculate optimal times for each period
    let todayOptimal: OptimalTimeDto | null = null;
    let tonightOptimal: OptimalTimeDto | null = null;
    let tomorrowOptimal: OptimalTimeDto | null = null;

    // Today optimal (only if currently daytime)
    if (isCurrentlyDaytime && todayDayPrices.length >= washingDurationHours) {
      const todayOptimalTimes = findOptimalPeriod(
        todayDayPrices,
        washingDurationHours,
      );
      if (todayOptimalTimes.length > 0) {
        todayOptimal = todayOptimalTimes[0];
      }
    }

    // Tonight optimal
    if (tonightPrices.length >= washingDurationHours) {
      const tonightOptimalTimes = findOptimalPeriod(
        tonightPrices,
        washingDurationHours,
      );
      if (tonightOptimalTimes.length > 0) {
        tonightOptimal = tonightOptimalTimes[0];
      }
    }

    // Tomorrow optimal
    if (tomorrowDayPrices.length >= washingDurationHours) {
      const tomorrowOptimalTimes = findOptimalPeriod(
        tomorrowDayPrices,
        washingDurationHours,
      );
      if (tomorrowOptimalTimes.length > 0) {
        tomorrowOptimal = tomorrowOptimalTimes[0];
      }
    }

    // Build result - only include tonight/tomorrow if cheaper than current hour
    // Note: nowOptimal might be null if not enough future price data is available
    const result: WashLaundryForecast = {
      ...(nowOptimal && { now: nowOptimal }),
      startDelays,
      defaults: {
        exchangeTariffCentsKwh: TARIFF_CONFIG.EXCHANGE_TARIFF_CENTS_KWH,
        marginTariffCentsKwh: TARIFF_CONFIG.MARGIN_TARIFF_CENTS_KWH,
        powerConsumptionKwh: WASH_ENERGY_KWH,
        periodHours: washingDurationHours,
      },
    } as WashLaundryForecast;

    if (todayOptimal) {
      result.today = todayOptimal;

      // Include tonight only if cheaper than today
      if (tonightOptimal && tonightOptimal.priceAvg < todayOptimal.priceAvg) {
        result.tonight = tonightOptimal;
      }

      // Include tomorrow only if cheaper than today
      if (tomorrowOptimal && tomorrowOptimal.priceAvg < todayOptimal.priceAvg) {
        result.tomorrow = tomorrowOptimal;
      }
    } else {
      // If no today optimal (e.g., after daytime hours), include tomorrow
      if (tomorrowOptimal) {
        result.tomorrow = tomorrowOptimal;
      }

      // Include tonight if available (no today to compare against)
      if (tonightOptimal) {
        result.tonight = tonightOptimal;
      }
    }

    return result;
  }

  /**
   * Cost of starting the program in the current 15-minute interval and
   * after each whole-hour timer delay.
   *
   * @param futurePrices - Prices from the current interval onwards
   */
  private calculateStartDelays(
    futurePrices: ElectricityPriceDto[],
    durationHours: number,
  ): StartDelayDto[] {
    const delays: StartDelayDto[] = [];
    if (futurePrices.length === 0) return delays;

    // Quarters are looked up by start time, so a missing quarter only drops
    // the delays whose program overlaps it
    const byStart = new Map(
      futurePrices.map((price) => [Date.parse(price.startDate), price]),
    );
    const firstStart = Date.parse(futurePrices[0].startDate);

    for (
      let delayHours = 0;
      delayHours <= MAX_START_DELAY_HOURS;
      delayHours++
    ) {
      const start = firstStart + delayHours * HOUR_MS;
      const slot = Array.from({ length: durationHours * 4 }, (_, q) =>
        byStart.get(start + q * QUARTER_MS),
      );
      if (slot.some((price) => !price)) continue;

      const [period] = findOptimalPeriod(
        slot as ElectricityPriceDto[],
        durationHours,
        1,
      );
      if (!period) continue;

      delays.push({
        delayHours,
        startTime: period.startTime,
        endTime: period.endTime,
        priceAvg: period.priceAvg,
        priceCategory: period.priceCategory,
        costCents: Math.round(period.priceAvg * WASH_ENERGY_KWH * 100) / 100,
        isBest: false,
      });
    }

    const best = delays.reduce<StartDelayDto | undefined>(
      (cheapest, delay) =>
        !cheapest || delay.costCents < cheapest.costCents ? delay : cheapest,
      undefined,
    );
    if (best) best.isBest = true;

    return delays;
  }

  private convertToFinnishTime(date: Date): Date {
    // Convert to Finnish timezone (UTC+3 in summer, UTC+2 in winter)
    // Use proper timezone conversion
    return new Date(
      date.toLocaleString('en-US', { timeZone: 'Europe/Helsinki' }),
    );
  }

  private isDaytime(finnishTime: Date): boolean {
    const hour = finnishTime.getHours();
    return hour >= 6 && hour <= 20;
  }

  private filterTodayDayPrices(
    todayPrices: ElectricityPriceDto[],
    now: Date,
  ): ElectricityPriceDto[] {
    return todayPrices.filter((price) => {
      const priceTime = new Date(price.startDate);
      const priceEndTime = new Date(price.endDate);
      const finnishPriceTime = this.convertToFinnishTime(priceTime);
      // Include current hour if it hasn't ended yet, and all future hours
      return priceEndTime > now && this.isDaytime(finnishPriceTime);
    });
  }

  private filterTonightPrices(
    todayPrices: ElectricityPriceDto[],
    tomorrowPrices: ElectricityPriceDto[],
    now: Date,
  ): ElectricityPriceDto[] {
    // Tonight prices: from now until end of today's night hours + tomorrow's early morning hours
    const allPrices = [...todayPrices, ...tomorrowPrices];
    return allPrices.filter((price) => {
      const priceTime = new Date(price.startDate);
      const priceEndTime = new Date(price.endDate);
      const finnishPriceTime = this.convertToFinnishTime(priceTime);
      const hour = finnishPriceTime.getHours();
      // Include current hour if it hasn't ended yet, and all future hours
      return priceEndTime > now && (hour > 20 || hour < 6);
    });
  }

  private filterTomorrowDayPrices(
    tomorrowPrices: ElectricityPriceDto[],
    now: Date,
  ): ElectricityPriceDto[] {
    return tomorrowPrices.filter((price) => {
      const priceTime = new Date(price.startDate);
      const priceEndTime = new Date(price.endDate);
      const finnishPriceTime = this.convertToFinnishTime(priceTime);
      // Include current hour if it hasn't ended yet, and all future hours
      return priceEndTime > now && this.isDaytime(finnishPriceTime);
    });
  }
}
