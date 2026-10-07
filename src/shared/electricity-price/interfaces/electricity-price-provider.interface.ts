import { ElectricityPriceDto } from '../dto/electricity-price.dto';

/**
 * Injection token for the list of price providers, in priority order.
 */
export const ELECTRICITY_PRICE_PROVIDERS = Symbol(
  'ELECTRICITY_PRICE_PROVIDERS',
);

/**
 * Contract for electricity price sources (ENTSO-E, spot-hinta.fi, ...).
 * A provider only fetches; PriceCacheService decides when to fetch, tries
 * providers in order and keeps the result in memory.
 */
export interface IElectricityPriceProvider {
  /** Source name used in logs. */
  readonly name: string;

  /**
   * Fetches published 15-minute prices overlapping startDate..endDate,
   * sorted by start time. Prices not yet published (tomorrow's before
   * around 14:00 Finnish time) are simply missing.
   *
   * @throws when the source is unavailable
   */
  fetchPrices(startDate: Date, endDate: Date): Promise<ElectricityPriceDto[]>;
}
