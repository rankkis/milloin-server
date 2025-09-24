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

    // Get price data for today and tomorrow (without internal caching)
    const todayPrices = await this.electricityPriceService.getTodayPrices();
    let tomorrowPrices: ElectricityPrice[] = [];

    try {
      tomorrowPrices = await this.electricityPriceService.getTomorrowPrices();
    } catch {
      // Tomorrow's prices might not be available yet (usually published around 14:00)
      console.warn("Tomorrow's prices not available yet");
    }

    // Combine and filter prices within the requested forecast hours
    const allPrices = [...todayPrices, ...tomorrowPrices];
    const now = new Date();
    const forecastEndTime = new Date(now.getTime() + hours * 60 * 60 * 1000);

    const availablePrices = allPrices.filter((price) => {
      const priceTime = new Date(price.startDate);
      return priceTime >= now && priceTime <= forecastEndTime;
    });

    if (availablePrices.length < washingDurationHours) {
      throw new BadRequestException(
        'Not enough price data available for forecast',
      );
    }

    // Separate day and night prices
    const { dayPrices, nightPrices } =
      this.separateDayNightPrices(availablePrices);

    // Calculate optimal times for day and night separately
    const dayOptimalTimes = this.findOptimalWashingTimes(
      dayPrices,
      washingDurationHours,
      'day',
    );
    const nightOptimalTimes = this.findOptimalWashingTimes(
      nightPrices,
      washingDurationHours,
      'night',
    );

    // Calculate statistics
    const allPricesValues = availablePrices.map((p) => p.price);
    const overallAveragePrice =
      allPricesValues.reduce((sum, price) => sum + price, 0) /
      allPricesValues.length;
    const overallLowestPrice = Math.min(...allPricesValues);
    const overallHighestPrice = Math.max(...allPricesValues);

    const dayPricesValues = dayPrices.map((p) => p.price);
    const dayAveragePrice =
      dayPricesValues.length > 0
        ? dayPricesValues.reduce((sum, price) => sum + price, 0) /
          dayPricesValues.length
        : 0;
    const dayLowestPrice =
      dayPricesValues.length > 0 ? Math.min(...dayPricesValues) : 0;

    const nightPricesValues = nightPrices.map((p) => p.price);
    const nightAveragePrice =
      nightPricesValues.length > 0
        ? nightPricesValues.reduce((sum, price) => sum + price, 0) /
          nightPricesValues.length
        : 0;
    const nightLowestPrice =
      nightPricesValues.length > 0 ? Math.min(...nightPricesValues) : 0;

    // Add savings calculations for day times
    const dayOptimalTimesWithSavings = dayOptimalTimes.map((time, index) => ({
      ...time,
      rank: index + 1,
      savings: dayAveragePrice - time.price,
      savingsPercentage:
        dayAveragePrice > 0
          ? ((dayAveragePrice - time.price) / dayAveragePrice) * 100
          : 0,
    }));

    // Add savings calculations for night times
    const nightOptimalTimesWithSavings = nightOptimalTimes.map(
      (time, index) => ({
        ...time,
        rank: index + 1,
        savings: nightAveragePrice - time.price,
        savingsPercentage:
          nightAveragePrice > 0
            ? ((nightAveragePrice - time.price) / nightAveragePrice) * 100
            : 0,
      }),
    );

    const maxSavings = overallAveragePrice - overallLowestPrice;
    const savingsPercentage = (maxSavings / overallAveragePrice) * 100;

    // Find overall cheapest time slot
    const allOptimalTimes = [...dayOptimalTimes, ...nightOptimalTimes];
    const overallCheapestTime = allOptimalTimes.reduce((cheapest, current) =>
      current.price < cheapest.price ? current : cheapest,
    );

    // Build the response
    const result: WashingForecast = {
      dayTime: {
        optimalTimes: dayOptimalTimesWithSavings,
        averagePrice: Math.round(dayAveragePrice * 100) / 100,
        lowestPrice: Math.round(dayLowestPrice * 100) / 100,
      },
      overallStats: {
        averagePrice: Math.round(overallAveragePrice * 100) / 100,
        lowestPrice: Math.round(overallLowestPrice * 100) / 100,
        highestPrice: Math.round(overallHighestPrice * 100) / 100,
        optimalTime: {
          startTime: overallCheapestTime.startTime,
          endTime: overallCheapestTime.endTime,
          price: overallCheapestTime.price,
          period: overallCheapestTime.period,
        },
        savings: {
          maxSavings: Math.round(maxSavings * 100) / 100,
          savingsPercentage: Math.round(savingsPercentage * 100) / 100,
        },
      },
    };

    // Include night times only if they're cheaper than the cheapest day time
    if (
      nightOptimalTimesWithSavings.length > 0 &&
      dayOptimalTimesWithSavings.length > 0
    ) {
      const cheapestNightPrice = Math.min(
        ...nightOptimalTimesWithSavings.map((t) => t.price),
      );
      const cheapestDayPrice = Math.min(
        ...dayOptimalTimesWithSavings.map((t) => t.price),
      );

      if (cheapestNightPrice < cheapestDayPrice) {
        const savingsVsDayTime = cheapestDayPrice - cheapestNightPrice;
        const savingsPercentageVsDayTime =
          (savingsVsDayTime / cheapestDayPrice) * 100;

        result.nightTime = {
          optimalTimes: nightOptimalTimesWithSavings,
          averagePrice: Math.round(nightAveragePrice * 100) / 100,
          lowestPrice: Math.round(nightLowestPrice * 100) / 100,
          savingsVsDayTime: Math.round(savingsVsDayTime * 100) / 100,
          savingsPercentageVsDayTime:
            Math.round(savingsPercentageVsDayTime * 100) / 100,
        };
      }
    }

    // Cache the result with TTL until the end of the hour of the optimal time
    const ttl = this.getTtlUntilEndOfOptimalHour(
      result.overallStats.optimalTime.startTime,
    );
    await this.cacheManager.set(cacheKey, result, ttl);

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

  private separateDayNightPrices(prices: ElectricityPrice[]): {
    dayPrices: ElectricityPrice[];
    nightPrices: ElectricityPrice[];
  } {
    const dayPrices: ElectricityPrice[] = [];
    const nightPrices: ElectricityPrice[] = [];

    prices.forEach((price) => {
      const startTime = new Date(price.startDate);
      const startHour = startTime.getHours();

      // Day time: 06:00-20:00 (latest start time for 2-hour cycle is 20:00)
      // Night time: 20:01-05:59
      if (startHour >= 6 && startHour <= 20) {
        dayPrices.push(price);
      } else {
        nightPrices.push(price);
      }
    });

    return { dayPrices, nightPrices };
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
