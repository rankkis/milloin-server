import {
  HttpException,
  HttpStatus,
  Injectable,
  Optional,
} from '@nestjs/common';
import { PricePoint } from '../../pricing/price-point';
import { Clock, systemClock } from '../clock/clock';
import {
  helsinkiTime,
  startOfHelsinkiDay,
} from '../utils/helsinki-time.helper';
import { ElectricityPriceDto } from './dto/electricity-price.dto';
import {
  PriceCacheService,
  TOMORROW_PUBLISHED_HELSINKI_HOUR,
} from './services/price-cache.service';

/** How current the prices in memory are */
export interface PriceFreshness {
  /** End of the last published price, ISO 8601 UTC */
  pricesUntil: string;
  /** Whether tomorrow's prices (Finnish day) are in */
  tomorrowPublished: boolean;
  /**
   * When the next day's prices are expected (about 14:00 Finnish time): today
   * until tomorrow's are in, then tomorrow. In the past while they are late.
   */
  nextPricesExpectedAt: string;
  /** The provider of the latest fetch, for example ENTSO-E */
  source?: string;
  /** When the prices were fetched from it */
  fetchedAt?: string;
}

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

  /** How current the prices are; call after getting prices */
  getFreshness(prices: PricePoint[]): PriceFreshness {
    const now = new Date(this.clock.now());
    const pricesUntil = prices.length
      ? Date.parse(prices[prices.length - 1].endTime)
      : 0;
    // A day's prices are published all at once
    const tomorrowPublished =
      pricesUntil > startOfHelsinkiDay(now, 1).getTime();
    return {
      pricesUntil: new Date(pricesUntil).toISOString(),
      tomorrowPublished,
      nextPricesExpectedAt: helsinkiTime(
        now,
        tomorrowPublished ? 1 : 0,
        TOMORROW_PUBLISHED_HELSINKI_HOUR,
      ).toISOString(),
      ...this.priceCache.getSource(),
    };
  }
}
