import { Injectable, Logger } from '@nestjs/common';
import { ElectricityPriceService } from '../shared/electricity-price/electricity-price.service';
import {
  OverviewDto,
  CurrentPriceDto,
  FuturePriceSummaryDto,
} from './dto/overview.dto';
import { ElectricityPriceDto } from '../shared/electricity-price/dto/electricity-price.dto';
import { PricePointDto } from '../shared/dto/optimal-time.dto';
import { calculatePriceCategory } from '../shared/electricity-price/utils/find-optimal-period.helper';

@Injectable()
export class OverviewService {
  private readonly logger = new Logger(OverviewService.name);

  constructor(
    private readonly electricityPriceService: ElectricityPriceService,
  ) {}

  async getOverview(): Promise<OverviewDto> {
    // Fetch all required data
    const [currentPrices, futurePrices] = await Promise.all([
      this.electricityPriceService.getCurrentPrices(),
      this.electricityPriceService.getFuturePrices(),
    ]);

    // Calculate current price info
    const current = this.calculateCurrentPrice(currentPrices[0]);

    // Calculate next 12 hours summary
    const next12HoursPrices = this.getNext12HoursPrices(futurePrices);
    const next12Hours = this.calculateFutureSummary(next12HoursPrices);

    // Calculate all future prices summary
    const future = this.calculateFutureSummary(futurePrices);

    return {
      current,
      next12Hours,
      future,
    };
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

    // Convert prices to cents and create price points
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
