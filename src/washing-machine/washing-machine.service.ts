import { Injectable, BadRequestException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import {
  ElectricityPriceService,
  ElectricityPrice,
} from './electricity-price.service';
import { WashingForecastDto } from './dto/washing-forecast.dto';
import { OptimalTimeDto } from './dto/optimal-time.dto';

// Re-export DTOs for backwards compatibility
export type WashingForecast = WashingForecastDto;
export type OptimalTime = OptimalTimeDto;

@Injectable()
export class WashingMachineService {
  constructor(
    private readonly electricityPriceService: ElectricityPriceService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async getForecast(hours: number = 24): Promise<WashingForecast> {
    const cacheKey = `washing-forecast-${hours}`;
    const cachedForecast =
      await this.cacheManager.get<WashingForecast>(cacheKey);

    if (cachedForecast) {
      return cachedForecast;
    }

    const washingDurationHours = 2; // Typical washing machine cycle

    // Get price data for today and tomorrow
    const todayPrices = await this.electricityPriceService.getTodayPrices();
    let tomorrowPrices: ElectricityPrice[] = [];

    try {
      tomorrowPrices = await this.electricityPriceService.getTomorrowPrices();
    } catch {
      console.warn("Tomorrow's prices not available yet");
    }

    // Get current time in Finnish timezone
    const now = new Date();
    const finnishTime = this.convertToFinnishTime(now);
    const isCurrentlyDaytime = this.isDaytime(finnishTime);

    // Separate periods for today, tonight, and tomorrow
    const todayDayPrices = this.filterTodayDayPrices(todayPrices, now);
    const tonightPrices = this.filterTonightPrices(todayPrices, tomorrowPrices, now);
    const tomorrowDayPrices = this.filterTomorrowDayPrices(tomorrowPrices, now);

    // Calculate optimal times for each period
    let todayOptimal: OptimalTimeDto | null = null;
    let tonightOptimal: OptimalTimeDto | null = null;
    let tomorrowOptimal: OptimalTimeDto | null = null;

    // Today optimal (only if currently daytime)
    if (isCurrentlyDaytime && todayDayPrices.length >= washingDurationHours) {
      const todayOptimalTimes = this.findOptimalWashingTimes(
        todayDayPrices,
        washingDurationHours,
        'day',
      );
      if (todayOptimalTimes.length > 0) {
        todayOptimal = {
          ...todayOptimalTimes[0],
          rank: 1,
          savings: 0, // Will calculate later
          savingsPercentage: 0,
        };
      }
    }

    // Tonight optimal
    if (tonightPrices.length >= washingDurationHours) {
      const tonightOptimalTimes = this.findOptimalWashingTimes(
        tonightPrices,
        washingDurationHours,
        'night',
      );
      if (tonightOptimalTimes.length > 0) {
        tonightOptimal = {
          ...tonightOptimalTimes[0],
          rank: 1,
          savings: 0, // Will calculate later
          savingsPercentage: 0,
        };
      }
    }

    // Tomorrow optimal
    if (tomorrowDayPrices.length >= washingDurationHours) {
      const tomorrowOptimalTimes = this.findOptimalWashingTimes(
        tomorrowDayPrices,
        washingDurationHours,
        'day',
      );
      if (tomorrowOptimalTimes.length > 0) {
        tomorrowOptimal = {
          ...tomorrowOptimalTimes[0],
          rank: 1,
          savings: 0, // Will calculate later
          savingsPercentage: 0,
        };
      }
    }

    // Build result - only include tonight/tomorrow if cheaper than today
    const result: WashingForecast = {};

    if (todayOptimal) {
      result.today = todayOptimal;

      // Only include tonight if cheaper than today
      if (tonightOptimal && tonightOptimal.price < todayOptimal.price) {
        const savings = todayOptimal.price - tonightOptimal.price;
        result.tonight = {
          ...tonightOptimal,
          savings: Math.round(savings * 100) / 100,
          savingsPercentage: Math.round((savings / todayOptimal.price) * 100 * 100) / 100,
        };
      }

      // Only include tomorrow if cheaper than today
      if (tomorrowOptimal && tomorrowOptimal.price < todayOptimal.price) {
        const savings = todayOptimal.price - tomorrowOptimal.price;
        result.tomorrow = {
          ...tomorrowOptimal,
          savings: Math.round(savings * 100) / 100,
          savingsPercentage: Math.round((savings / todayOptimal.price) * 100 * 100) / 100,
        };
      }
    }

    // Cache the result with TTL
    const bestOption = result.tonight || result.tomorrow || result.today;
    if (bestOption) {
      const ttl = this.getTtlUntilEndOfOptimalHour(bestOption.startTime);
      await this.cacheManager.set(cacheKey, result, ttl);
    }

    return result;
  }

  private getTtlUntilEndOfOptimalHour(optimalStartTime: string): number {
    const optimalTime = new Date(optimalStartTime);
    const endOfOptimalHour = new Date(optimalTime);
    endOfOptimalHour.setMinutes(59, 59, 999);

    const now = new Date();
    return Math.max(
      1,
      Math.floor((endOfOptimalHour.getTime() - now.getTime()) / 1000),
    );
  }

  private convertToFinnishTime(date: Date): Date {
    // Convert to Finnish timezone (UTC+2 in winter, UTC+3 in summer)
    const offset = date.getTimezoneOffset();
    const finnishOffset = this.getFinnishTimezoneOffset(date);
    return new Date(date.getTime() + (offset + finnishOffset) * 60 * 1000);
  }

  private getFinnishTimezoneOffset(date: Date): number {
    // Simplified: assume UTC+3 (summer time) for now
    // In production, you'd want proper timezone handling
    return -180; // -3 hours in minutes
  }

  private isDaytime(finnishTime: Date): boolean {
    const hour = finnishTime.getHours();
    return hour >= 6 && hour <= 20;
  }

  private filterTodayDayPrices(todayPrices: ElectricityPrice[], now: Date): ElectricityPrice[] {
    return todayPrices.filter((price) => {
      const priceTime = new Date(price.startDate);
      const finnishPriceTime = this.convertToFinnishTime(priceTime);
      return priceTime >= now && this.isDaytime(finnishPriceTime);
    });
  }

  private filterTonightPrices(todayPrices: ElectricityPrice[], tomorrowPrices: ElectricityPrice[], now: Date): ElectricityPrice[] {
    // Tonight prices: from now until end of today's night hours + tomorrow's early morning hours
    const allPrices = [...todayPrices, ...tomorrowPrices];
    return allPrices.filter((price) => {
      const priceTime = new Date(price.startDate);
      const finnishPriceTime = this.convertToFinnishTime(priceTime);
      const hour = finnishPriceTime.getHours();
      return priceTime >= now && (hour > 20 || hour < 6);
    });
  }

  private filterTomorrowDayPrices(tomorrowPrices: ElectricityPrice[], now: Date): ElectricityPrice[] {
    return tomorrowPrices.filter((price) => {
      const priceTime = new Date(price.startDate);
      const finnishPriceTime = this.convertToFinnishTime(priceTime);
      return priceTime >= now && this.isDaytime(finnishPriceTime);
    });
  }

  private findOptimalWashingTimes(
    prices: ElectricityPrice[],
    durationHours: number,
    period: 'day' | 'night',
  ): Omit<OptimalTime, 'rank' | 'savings' | 'savingsPercentage'>[] {
    const optimalSlots: Array<{
      startTime: string;
      endTime: string;
      price: number;
      period: 'day' | 'night';
    }> = [];

    // Find all possible consecutive time slots of the required duration
    for (let i = 0; i <= prices.length - durationHours; i++) {
      const slot = prices.slice(i, i + durationHours);

      // Check if the slot is consecutive (no gaps in time)
      let isConsecutive = true;
      for (let j = 1; j < slot.length; j++) {
        const prevEndTime = new Date(slot[j - 1].endDate).getTime();
        const currentStartTime = new Date(slot[j].startDate).getTime();
        if (prevEndTime !== currentStartTime) {
          isConsecutive = false;
          break;
        }
      }

      if (isConsecutive) {
        const averagePrice =
          slot.reduce((sum, hour) => sum + hour.price, 0) / slot.length;
        optimalSlots.push({
          startTime: slot[0].startDate,
          endTime: slot[slot.length - 1].endDate,
          price: Math.round(averagePrice * 100) / 100,
          period,
        });
      }
    }

    // Sort by price (cheapest first) and return top 5
    return optimalSlots.sort((a, b) => a.price - b.price).slice(0, 5);
  }
}
