import { Injectable } from '@nestjs/common';
import { TARIFF_CONFIG } from '../shared/config/tariff.config';
import { OptimalTimeDto } from '../shared/dto/optimal-time.dto';
import { ElectricityPriceDto } from '../shared/electricity-price/dto/electricity-price.dto';
import { ElectricityPriceService } from '../shared/electricity-price/electricity-price.service';
import { findOptimalPeriod } from '../shared/electricity-price/utils/find-optimal-period.helper';
import { WashingForecastDto } from './dto/washing-forecast.dto';

// Re-export DTOs for backwards compatibility
export type WashingForecast = WashingForecastDto;
export type OptimalTime = OptimalTimeDto;

@Injectable()
export class WashingMachineService {
  constructor(
    private readonly electricityPriceService: ElectricityPriceService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getForecast(_hours = 24): Promise<WashingForecast> {
    const washingDurationHours = 2; // Typical washing machine cycle

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
    const startingNowPrices = allFuturePrices.slice(0, washingDurationHours);

    // Calculate "now" optimal time (what it costs to start right now)
    let nowOptimal: OptimalTimeDto | null = null;
    if (startingNowPrices.length >= washingDurationHours) {
      const nowOptimalResult = findOptimalPeriod(
        startingNowPrices,
        washingDurationHours,
        1,
      );
      if (nowOptimalResult.length > 0) {
        nowOptimal = {
          ...nowOptimalResult[0],
          potentialSavings: null, // No savings when starting now
          potentialSavingsPercentage: null,
        };
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
        todayOptimal = {
          ...todayOptimalTimes[0],
          potentialSavings: null, // Will calculate later
          potentialSavingsPercentage: null,
        };
      }
    }

    // Tonight optimal
    if (tonightPrices.length >= washingDurationHours) {
      const tonightOptimalTimes = findOptimalPeriod(
        tonightPrices,
        washingDurationHours,
      );
      if (tonightOptimalTimes.length > 0) {
        tonightOptimal = {
          ...tonightOptimalTimes[0],
          potentialSavings: null, // Will calculate later
          potentialSavingsPercentage: null,
        };
      }
    }

    // Tomorrow optimal
    if (tomorrowDayPrices.length >= washingDurationHours) {
      const tomorrowOptimalTimes = findOptimalPeriod(
        tomorrowDayPrices,
        washingDurationHours,
      );
      if (tomorrowOptimalTimes.length > 0) {
        tomorrowOptimal = {
          ...tomorrowOptimalTimes[0],
          potentialSavings: null, // Will calculate later
          potentialSavingsPercentage: null,
        };
      }
    }

    // Build result - only include tonight/tomorrow if cheaper than current hour
    // Note: nowOptimal might be null if not enough future price data is available
    const result: WashingForecast = {
      ...(nowOptimal && { now: nowOptimal }),
      defaults: {
        exchangeTariffCentsKwh: TARIFF_CONFIG.EXCHANGE_TARIFF_CENTS_KWH,
        marginTariffCentsKwh: TARIFF_CONFIG.MARGIN_TARIFF_CENTS_KWH,
        powerConsumptionKwh: 0.7, // Washing machine default power consumption
        periodHours: washingDurationHours,
      },
    } as WashingForecast;

    // Calculate savings by comparing optimal period vs starting now
    const calculateSavings = (
      optimal: OptimalTimeDto,
    ): {
      potentialSavings: number | null;
      potentialSavingsPercentage: number | null;
    } => {
      // If currently in optimal time, no savings to calculate
      if (this.isCurrentHourOptimal(optimal)) {
        return { potentialSavings: null, potentialSavingsPercentage: null };
      }

      // If nowOptimal is not available, can't calculate savings
      if (!nowOptimal) {
        return { potentialSavings: null, potentialSavingsPercentage: null };
      }

      // Calculate savings: (now price) - (optimal price)
      const savings =
        nowOptimal.estimatedTotalPrice - optimal.estimatedTotalPrice;
      const savingsPercentage =
        (savings / nowOptimal.estimatedTotalPrice) * 100;

      return {
        potentialSavings: Math.round(savings * 100) / 100,
        potentialSavingsPercentage: Math.round(savingsPercentage * 100) / 100,
      };
    };

    if (todayOptimal) {
      const todaySavings = calculateSavings(todayOptimal);
      result.today = {
        ...todayOptimal,
        ...todaySavings,
      };

      // Include tonight only if cheaper than today
      if (tonightOptimal && tonightOptimal.priceAvg < todayOptimal.priceAvg) {
        const tonightSavings = calculateSavings(tonightOptimal);
        result.tonight = {
          ...tonightOptimal,
          ...tonightSavings,
        };
      }

      // Include tomorrow only if cheaper than today
      if (tomorrowOptimal && tomorrowOptimal.priceAvg < todayOptimal.priceAvg) {
        const tomorrowSavings = calculateSavings(tomorrowOptimal);
        result.tomorrow = {
          ...tomorrowOptimal,
          ...tomorrowSavings,
        };
      }
    } else {
      // If no today optimal (e.g., after daytime hours), include tomorrow
      if (tomorrowOptimal) {
        const tomorrowSavings = calculateSavings(tomorrowOptimal);
        result.tomorrow = {
          ...tomorrowOptimal,
          ...tomorrowSavings,
        };
      }

      // Include tonight if available (no today to compare against)
      if (tonightOptimal) {
        const tonightSavings = calculateSavings(tonightOptimal);
        result.tonight = {
          ...tonightOptimal,
          ...tonightSavings,
        };
      }
    }

    return result;
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

  private isCurrentHourOptimal(optimal: OptimalTimeDto): boolean {
    const now = new Date();
    const currentHour = new Date(now);
    currentHour.setMinutes(0, 0, 0);

    const optimalStart = new Date(optimal.startTime);
    const optimalEnd = new Date(optimal.endTime);

    // Check if current hour falls within the optimal time period
    return currentHour >= optimalStart && currentHour < optimalEnd;
  }
}
