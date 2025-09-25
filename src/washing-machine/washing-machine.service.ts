import { Injectable } from '@nestjs/common';
import { ElectricityPriceFiService } from '../shared/electricity-price-fi/electricity-price-fi.service';
import { ElectricityPriceDto } from '../shared/electricity-price-fi/dto/electricity-price.dto';
import { WashingForecastDto } from './dto/washing-forecast.dto';
import { OptimalTimeDto } from './dto/optimal-time.dto';

// Re-export DTOs for backwards compatibility
export type WashingForecast = WashingForecastDto;
export type OptimalTime = OptimalTimeDto;

@Injectable()
export class WashingMachineService {
  constructor(
    private readonly electricityPriceService: ElectricityPriceFiService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getForecast(_hours = 24): Promise<WashingForecast> {
    const washingDurationHours = 2; // Typical washing machine cycle

    // Get price data for today, tomorrow, and current hour
    const todayPrices = await this.electricityPriceService.getTodayPrices();
    let tomorrowPrices: ElectricityPriceDto[] = [];
    const currentHourPrice = await this.getCurrentHourPrice();

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
    const tonightPrices = this.filterTonightPrices(
      todayPrices,
      tomorrowPrices,
      now,
    );
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
      );
      if (todayOptimalTimes.length > 0) {
        todayOptimal = {
          ...todayOptimalTimes[0],
          rank: 1,
          potentialSavings: null, // Will calculate later
          potentialSavingsPercentage: null,
        };
      }
    }

    // Tonight optimal
    if (tonightPrices.length >= washingDurationHours) {
      const tonightOptimalTimes = this.findOptimalWashingTimes(
        tonightPrices,
        washingDurationHours,
      );
      if (tonightOptimalTimes.length > 0) {
        tonightOptimal = {
          ...tonightOptimalTimes[0],
          rank: 1,
          potentialSavings: null, // Will calculate later
          potentialSavingsPercentage: null,
        };
      }
    }

    // Tomorrow optimal
    if (tomorrowDayPrices.length >= washingDurationHours) {
      const tomorrowOptimalTimes = this.findOptimalWashingTimes(
        tomorrowDayPrices,
        washingDurationHours,
      );
      if (tomorrowOptimalTimes.length > 0) {
        tomorrowOptimal = {
          ...tomorrowOptimalTimes[0],
          rank: 1,
          potentialSavings: null, // Will calculate later
          potentialSavingsPercentage: null,
        };
      }
    }

    // Build result - only include tonight/tomorrow if cheaper than current hour
    const result: WashingForecast = {};

    // Calculate savings relative to current hour price
    const calculateSavings = (
      optimal: OptimalTimeDto,
    ): {
      potentialSavings: number | null;
      potentialSavingsPercentage: number | null;
    } => {
      if (!currentHourPrice || this.isCurrentHourOptimal(optimal)) {
        return { potentialSavings: null, potentialSavingsPercentage: null };
      }

      const savings = currentHourPrice - optimal.price;
      const savingsPercentage = (savings / currentHourPrice) * 100;

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

      // Only include tonight if cheaper than current hour (or cheaper than today if no current price)
      const tonightThreshold = currentHourPrice || todayOptimal.price;
      if (tonightOptimal && tonightOptimal.price < tonightThreshold) {
        const tonightSavings = calculateSavings(tonightOptimal);
        result.tonight = {
          ...tonightOptimal,
          ...tonightSavings,
        };
      }

      // Only include tomorrow if cheaper than current hour (or cheaper than today if no current price)
      const tomorrowThreshold = currentHourPrice || todayOptimal.price;
      if (tomorrowOptimal && tomorrowOptimal.price < tomorrowThreshold) {
        const tomorrowSavings = calculateSavings(tomorrowOptimal);
        result.tomorrow = {
          ...tomorrowOptimal,
          ...tomorrowSavings,
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
      const finnishPriceTime = this.convertToFinnishTime(priceTime);
      return priceTime >= now && this.isDaytime(finnishPriceTime);
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
      const finnishPriceTime = this.convertToFinnishTime(priceTime);
      const hour = finnishPriceTime.getHours();
      return priceTime >= now && (hour > 20 || hour < 6);
    });
  }

  private filterTomorrowDayPrices(
    tomorrowPrices: ElectricityPriceDto[],
    now: Date,
  ): ElectricityPriceDto[] {
    return tomorrowPrices.filter((price) => {
      const priceTime = new Date(price.startDate);
      const finnishPriceTime = this.convertToFinnishTime(priceTime);
      return priceTime >= now && this.isDaytime(finnishPriceTime);
    });
  }

  private findOptimalWashingTimes(
    prices: ElectricityPriceDto[],
    durationHours: number,
  ): Omit<
    OptimalTime,
    'rank' | 'potentialSavings' | 'potentialSavingsPercentage'
  >[] {
    const optimalSlots: Array<{
      startTime: string;
      endTime: string;
      price: number;
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
        });
      }
    }

    // Sort by price (cheapest first) and return top 5
    return optimalSlots.sort((a, b) => a.price - b.price).slice(0, 5);
  }

  private async getCurrentHourPrice(): Promise<number | null> {
    try {
      const currentPrices =
        await this.electricityPriceService.getCurrentPrices();

      if (currentPrices.length === 0) {
        console.warn('No current price data available');
        return null;
      }

      // Find the price for the current hour
      const now = new Date();
      const currentHour = new Date(now);
      currentHour.setMinutes(0, 0, 0);

      const currentHourData = currentPrices.find((price) => {
        const priceStart = new Date(price.startDate);
        return priceStart.getTime() === currentHour.getTime();
      });

      if (!currentHourData) {
        // Fallback: use first price if exact hour match not found
        console.warn(
          'Exact current hour price not found, using first available price',
        );
        return currentPrices[0].price;
      }

      return currentHourData.price;
    } catch (error) {
      console.warn('Failed to fetch current hour price:', error);
      return null;
    }
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
