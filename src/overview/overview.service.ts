import { Injectable, Logger } from '@nestjs/common';
import { ElectricityPriceService } from '../shared/electricity-price/electricity-price.service';
import {
  OverviewDto,
  CurrentPriceDto,
  FuturePriceSummaryDto,
  HourlyPriceDto,
} from './dto/overview.dto';
import { ElectricityPriceDto } from '../shared/electricity-price/dto/electricity-price.dto';
import { PricePointDto } from '../shared/dto/optimal-time.dto';
import {
  calculatePriceCategory,
  findOptimalPeriod,
} from '../shared/electricity-price/utils/find-optimal-period.helper';
import { startOfHelsinkiDay } from '../shared/utils/helsinki-time.helper';

const HOUR_MS = 60 * 60 * 1000;

/** Length of the cheapest window shown on the home screen */
const CHEAPEST_WINDOW_HOURS = 2;

@Injectable()
export class OverviewService {
  private readonly logger = new Logger(OverviewService.name);

  constructor(
    private readonly electricityPriceService: ElectricityPriceService,
  ) {}

  async getOverview(): Promise<OverviewDto> {
    // Fetch all required data
    const [currentPrices, futurePrices, todayPrices, tomorrowPrices] =
      await Promise.all([
        this.electricityPriceService.getCurrentPrices(),
        this.electricityPriceService.getFuturePrices(),
        this.electricityPriceService.getTodayPrices(),
        this.electricityPriceService.getTomorrowPrices(),
      ]);

    // Calculate current price info
    const current = this.calculateCurrentPrice(currentPrices[0]);

    // Calculate next 12 hours summary
    const next12HoursPrices = this.getNext12HoursPrices(futurePrices);
    const next12Hours = this.calculateFutureSummary(next12HoursPrices);

    // Calculate all future prices summary
    const future = this.calculateFutureSummary(futurePrices);

    const today = this.calculateHourlyPrices(todayPrices);
    const cheapestWindow = this.findCheapestWindow([
      ...todayPrices,
      ...tomorrowPrices,
    ]);

    return {
      current,
      next12Hours,
      future,
      today,
      ...(cheapestWindow && { cheapestWindow }),
    };
  }

  /**
   * Groups today's 15-minute prices into Finnish clock hours.
   * Hours are counted from Finnish midnight, so daylight saving change days
   * give 23 or 25 hours.
   */
  private calculateHourlyPrices(
    todayPrices: ElectricityPriceDto[],
  ): HourlyPriceDto[] {
    const dayStart = startOfHelsinkiDay(new Date()).getTime();
    const hours = new Map<number, number[]>();

    for (const price of todayPrices) {
      const hourIndex = Math.floor(
        (Date.parse(price.startDate) - dayStart) / HOUR_MS,
      );
      const cents = price.price * 100;
      hours.set(hourIndex, [...(hours.get(hourIndex) ?? []), cents]);
    }

    return [...hours.entries()]
      .sort(([a], [b]) => a - b)
      .map(([hourIndex, cents]) => {
        const start = dayStart + hourIndex * HOUR_MS;
        const avg = cents.reduce((sum, c) => sum + c, 0) / cents.length;
        const priceAvg = Math.round(avg * 100) / 100;
        return {
          startTime: new Date(start).toISOString(),
          endTime: new Date(start + HOUR_MS).toISOString(),
          priceAvg,
          priceCategory: calculatePriceCategory(priceAvg),
        };
      });
  }

  /**
   * Cheapest window of CHEAPEST_WINDOW_HOURS that has not ended yet,
   * starting from the current quarter hour at the earliest.
   */
  private findCheapestWindow(prices: ElectricityPriceDto[]) {
    const now = Date.now();
    const remaining = prices.filter((price) => Date.parse(price.endDate) > now);
    return findOptimalPeriod(remaining, CHEAPEST_WINDOW_HOURS, 1)[0];
  }

  private calculateCurrentPrice(
    currentPrice: ElectricityPriceDto,
  ): CurrentPriceDto {
    const priceInCents = currentPrice.price * 100;
    const roundedPrice = Math.round(priceInCents * 100) / 100;

    return {
      price: roundedPrice,
      priceCategory: calculatePriceCategory(roundedPrice),
    };
  }

  private getNext12HoursPrices(
    futurePrices: ElectricityPriceDto[],
  ): ElectricityPriceDto[] {
    const now = new Date();
    const next12Hours = new Date(now.getTime() + 12 * 60 * 60 * 1000);

    return futurePrices.filter((price) => {
      const priceStart = new Date(price.startDate);
      return priceStart < next12Hours;
    });
  }

  /**
   * Calculates summary statistics for future electricity prices.
   * Prices are already in 15-minute intervals from the database.
   */
  private calculateFutureSummary(
    prices: ElectricityPriceDto[],
  ): FuturePriceSummaryDto {
    if (prices.length === 0) {
      this.logger.warn('No future prices available for summary calculation');
      return {
        priceAvg: 0,
        priceCategory: calculatePriceCategory(0),
        pricePoints: [],
      };
    }

    // Convert prices to cents and create price points (no tariffs - frontend handles total estimations)
    const pricePoints: PricePointDto[] = prices.map((price) => ({
      startTime: price.startDate,
      endTime: price.endDate,
      price: Math.round(price.price * 100 * 100) / 100, // Convert EUR to cents, round to 2 decimals
    }));

    // Calculate average price in cents
    const totalPrice = pricePoints.reduce((sum, point) => sum + point.price, 0);
    const avgPrice = totalPrice / pricePoints.length;
    const roundedAvg = Math.round(avgPrice * 100) / 100;

    return {
      priceAvg: roundedAvg,
      priceCategory: calculatePriceCategory(roundedAvg),
      pricePoints,
    };
  }
}
