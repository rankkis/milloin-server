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

      // Include tonight only if cheaper than today
      if (tonightOptimal && tonightOptimal.price < todayOptimal.price) {
        const tonightSavings = calculateSavings(tonightOptimal);
        result.tonight = {
          ...tonightOptimal,
          ...tonightSavings,
        };
      }

      // Include tomorrow only if cheaper than today
      if (tomorrowOptimal && tomorrowOptimal.price < todayOptimal.price) {
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
          price: Math.round(averagePrice * 100 * 100) / 100, // Convert euros to cents and round to 2 decimal places
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

      // Convert current time to Finnish timezone and normalize to hour boundary
      const now = new Date();
      const finnishNow = this.convertToFinnishTime(now);
      const currentHour = new Date(finnishNow);
      currentHour.setMinutes(0, 0, 0);

      console.log(
        'Looking for current hour price at:',
        currentHour.toISOString(),
      );
      console.log(
        'Available price data:',
        currentPrices.map((p) => ({ startDate: p.startDate, price: p.price })),
      );

      const currentHourData = currentPrices.find((price) => {
        const priceStart = new Date(price.startDate);
        const finnishPriceStart = this.convertToFinnishTime(priceStart);
        finnishPriceStart.setMinutes(0, 0, 0);

        return finnishPriceStart.getTime() === currentHour.getTime();
      });

      if (!currentHourData) {
        // Enhanced fallback: find closest hour within reasonable range
        console.warn(
          'Exact current hour price not found, searching for closest match',
        );

        const closestHourData = currentPrices.find((price) => {
          const priceStart = new Date(price.startDate);
          const finnishPriceStart = this.convertToFinnishTime(priceStart);
          const timeDiff = Math.abs(
            finnishPriceStart.getTime() - finnishNow.getTime(),
          );
          // Within 1 hour (3600000 ms)
          return timeDiff <= 3600000;
        });

        if (closestHourData) {
          console.warn(
            'Using closest hour price from:',
            closestHourData.startDate,
          );
          return closestHourData.price * 100; // Convert euros to cents
        }

        // Final fallback: use first price
        console.warn('No close match found, using first available price');
        return currentPrices[0].price * 100; // Convert euros to cents
      }

      return currentHourData.price * 100; // Convert euros to cents
    } catch (error) {
      console.error('Failed to fetch current hour price:', error);
      console.error('Error details:', error.message, error.stack);
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
