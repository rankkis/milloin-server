import {
  HttpException,
  HttpStatus,
  Injectable,
  Optional,
} from '@nestjs/common';
import { PricePoint } from '../../pricing/price-point';
import { Clock, systemClock } from '../clock/clock';
import { startOfHelsinkiDay } from '../utils/helsinki-time.helper';
import { ElectricityPriceDto } from './dto/electricity-price.dto';
import { PriceCacheService } from './services/price-cache.service';

/** Providers give €/kWh; everything after this works in c/kWh */
const toPricePoint = (price: ElectricityPriceDto): PricePoint => ({
  startTime: price.startDate,
  endTime: price.endDate,
  price: price.price * 100,
});

/**
 * Serves electricity prices from memory as 15-minute prices in c/kWh
 * (VAT included, not rounded). Days are Finnish days, from midnight to
 * midnight Europe/Helsinki time.
 */
@Injectable()
export class ElectricityPriceService {
  /** The cache's last price list and its conversion, so it is converted once */
  private converted?: { from: ElectricityPriceDto[]; to: PricePoint[] };

  constructor(
    private readonly priceCache: PriceCacheService,
    @Optional() private readonly clock: Clock = systemClock,
  ) {}

  /** Every price in memory: from Finnish midnight today to the last published one */
  async getPrices(): Promise<PricePoint[]> {
    const prices = await this.priceCache.getPrices();
    if (this.converted?.from !== prices) {
      this.converted = { from: prices, to: prices.map(toPricePoint) };
    }
    return this.converted.to;
  }

  /** Prices that have not ended: the current quarter onwards */
  async getUpcomingPrices(): Promise<PricePoint[]> {
    const now = this.clock.now();
    const prices = await this.getPrices();
    return prices.filter((price) => Date.parse(price.endTime) > now);
  }

  /** The price of the current quarter; 503 when it is not in memory */
  async getCurrentPrice(): Promise<PricePoint> {
    const now = this.clock.now();
    const prices = await this.getPrices();
    const current = prices.find(
      (price) =>
        Date.parse(price.startTime) <= now && Date.parse(price.endTime) > now,
    );
    if (!current) {
      throw new HttpException(
        'Current electricity price not available',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return current;
  }

  /** Prices of one Finnish day: 0 is today, 1 tomorrow */
  async getDayPrices(daysFromToday: number): Promise<PricePoint[]> {
    const now = new Date(this.clock.now());
    const dayStart = startOfHelsinkiDay(now, daysFromToday).getTime();
    const dayEnd = startOfHelsinkiDay(now, daysFromToday + 1).getTime();
    const prices = await this.getPrices();
    return prices.filter((price) => {
      const start = Date.parse(price.startTime);
      return start >= dayStart && start < dayEnd;
    });
  }
}
