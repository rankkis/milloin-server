import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ElectricityPriceDto } from '../dto/electricity-price.dto';
import {
  ELECTRICITY_PRICE_PROVIDERS,
  IElectricityPriceProvider,
} from '../interfaces/electricity-price-provider.interface';
import {
  helsinkiParts,
  startOfHelsinkiDay,
} from '../../utils/helsinki-time.helper';

/**
 * Next day's prices are published around 13:45 Finnish time (12:45 CET
 * day-ahead auction). From this Finnish hour onwards they are expected in
 * memory.
 */
const TOMORROW_PUBLISHED_HELSINKI_HOUR = 14;

/**
 * A delivery day runs from midnight to midnight CET, which is 22:00 UTC
 * (summer) or 23:00 UTC (winter). 22:00 is used as the safe lower bound.
 */
const DELIVERY_DAY_END_UTC_HOUR = 22;

/**
 * While tomorrow's prices are late, upstream is asked again at most this
 * often. Requests in between are answered from memory.
 */
const MIN_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

/**
 * Keeps electricity prices in memory.
 *
 * Prices are refreshed when ENTSO-E publishes the next day's prices, and on
 * demand whenever memory is empty or outdated: the request then waits for the
 * fetch, gets the fresh prices and leaves them in memory for the next
 * requests. On serverless hosts memory lives per instance, so a cold start
 * begins empty and fills on its first request.
 */
@Injectable()
export class PriceCacheService implements OnModuleInit {
  private readonly logger = new Logger(PriceCacheService.name);
  private prices: ElectricityPriceDto[] = [];
  private lastAttemptAt = 0;
  private refreshing: Promise<ElectricityPriceDto[]> | null = null;

  constructor(
    @Inject(ELECTRICITY_PRICE_PROVIDERS)
    private readonly providers: IElectricityPriceProvider[],
  ) {}

  onModuleInit(): void {
    // Warm up without delaying startup; a request arriving meanwhile waits
    // for this same fetch.
    this.refresh().catch((error) =>
      this.logger.warn('Initial price fetch failed', error),
    );
  }

  /**
   * Refreshes after the next day's prices are published, with a retry an
   * hour later in case publication is late. Only runs on long-lived hosts;
   * on serverless the on-demand refresh in getPrices() does the job.
   */
  @Cron('0 14,15 * * *', {
    name: 'refresh-electricity-prices',
    timeZone: 'Europe/Helsinki',
  })
  async scheduledRefresh(): Promise<void> {
    try {
      await this.refresh();
    } catch (error) {
      this.logger.error('Scheduled price refresh failed', error);
    }
  }

  /**
   * Returns all prices in memory, sorted by start time, from midnight of the
   * current Finnish day up to the last published price. Fetches them first when
   * memory is empty or outdated.
   */
  async getPrices(): Promise<ElectricityPriceDto[]> {
    const now = new Date();
    if (this.isUpToDate(now)) {
      return this.prices;
    }

    if (
      this.coversTime(now) &&
      now.getTime() - this.lastAttemptAt < MIN_REFRESH_INTERVAL_MS
    ) {
      return this.prices;
    }

    try {
      return await this.refresh();
    } catch (error) {
      if (this.coversTime(now)) {
        this.logger.warn('Price refresh failed, serving prices from memory');
        return this.prices;
      }
      throw error;
    }
  }

  /**
   * Fetches prices and stores them in memory. Concurrent callers share one
   * fetch.
   */
  refresh(): Promise<ElectricityPriceDto[]> {
    if (!this.refreshing) {
      this.refreshing = this.fetchPrices()
        .then((prices) => this.store(prices))
        .finally(() => {
          this.refreshing = null;
        });
    }
    return this.refreshing;
  }

  /**
   * Tries each provider in priority order and returns the first non-empty
   * result.
   */
  private async fetchPrices(): Promise<ElectricityPriceDto[]> {
    this.lastAttemptAt = Date.now();
    const now = new Date();
    const start = startOfHelsinkiDay(now);
    const end = startOfHelsinkiDay(now, 2);

    let lastError: unknown = new Error('No price providers configured');
    for (const provider of this.providers) {
      try {
        const prices = await provider.fetchPrices(start, end);
        if (prices.length > 0) {
          this.logger.log(
            `Fetched ${prices.length} prices from ${provider.name}`,
          );
          return prices;
        }
        lastError = new Error(`${provider.name} returned no prices`);
        this.logger.warn(lastError);
      } catch (error) {
        lastError = error;
        this.logger.warn(`${provider.name} fetch failed`, error);
      }
    }
    throw lastError;
  }

  /**
   * Merges fetched prices over the ones in memory and drops prices from
   * previous Finnish days.
   */
  private store(fetched: ElectricityPriceDto[]): ElectricityPriceDto[] {
    const keepFrom = startOfHelsinkiDay(new Date()).getTime();
    const byStart = new Map<string, ElectricityPriceDto>();
    for (const price of [...this.prices, ...fetched]) {
      if (Date.parse(price.endDate) > keepFrom) {
        byStart.set(price.startDate, price);
      }
    }

    this.prices = [...byStart.values()].sort(
      (a, b) => Date.parse(a.startDate) - Date.parse(b.startDate),
    );
    return this.prices;
  }

  /**
   * Up to date means memory reaches the end of the last delivery day that
   * should already be published: today's before 14:00 Finnish time,
   * tomorrow's after it.
   */
  private isUpToDate(now: Date): boolean {
    const helsinki = helsinkiParts(now);
    const daysAhead = helsinki.hour >= TOMORROW_PUBLISHED_HELSINKI_HOUR ? 1 : 0;
    const requiredEnd = Date.UTC(
      helsinki.year,
      helsinki.month - 1,
      helsinki.day + daysAhead,
      DELIVERY_DAY_END_UTC_HOUR,
    );
    return this.coversTime(now) && this.lastEnd() >= requiredEnd;
  }

  private coversTime(time: Date): boolean {
    return (
      this.prices.length > 0 &&
      Date.parse(this.prices[0].startDate) <= time.getTime() &&
      this.lastEnd() > time.getTime()
    );
  }

  private lastEnd(): number {
    return this.prices.length > 0
      ? Date.parse(this.prices[this.prices.length - 1].endDate)
      : 0;
  }
}
