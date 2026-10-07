import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ElectricityPriceDto } from './dto/electricity-price.dto';
import { PriceCacheService } from './services/price-cache.service';
import { startOfHelsinkiDay } from '../utils/helsinki-time.helper';

/**
 * Serves electricity prices from memory. Days are Finnish days, from
 * midnight to midnight Europe/Helsinki time.
 */
@Injectable()
export class ElectricityPriceService {
  constructor(private readonly priceCache: PriceCacheService) {}

  async getCurrentPrices(): Promise<ElectricityPriceDto[]> {
    const now = Date.now();
    const prices = await this.priceCache.getPrices();
    const current = prices.find(
      (price) =>
        Date.parse(price.startDate) <= now && Date.parse(price.endDate) > now,
    );

    if (!current) {
      throw new HttpException(
        'Current electricity price not available',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return [current];
  }

  async getTodayPrices(): Promise<ElectricityPriceDto[]> {
    return this.getDayPrices(0);
  }

  async getTomorrowPrices(): Promise<ElectricityPriceDto[]> {
    return this.getDayPrices(1);
  }

  /**
   * Prices starting from now onwards: the rest of today and tomorrow when
   * published.
   */
  async getFuturePrices(): Promise<ElectricityPriceDto[]> {
    const now = Date.now();
    const prices = await this.priceCache.getPrices();
    return prices.filter((price) => Date.parse(price.startDate) >= now);
  }

  private async getDayPrices(
    daysFromToday: number,
  ): Promise<ElectricityPriceDto[]> {
    const now = new Date();
    const dayStart = startOfHelsinkiDay(now, daysFromToday).getTime();
    const dayEnd = startOfHelsinkiDay(now, daysFromToday + 1).getTime();

    const prices = await this.priceCache.getPrices();
    return prices.filter((price) => {
      const start = Date.parse(price.startDate);
      return start >= dayStart && start < dayEnd;
    });
  }
}
