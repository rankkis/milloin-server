import { ElectricityPriceDto } from '../dto/electricity-price.dto';

/**
 * Contract for electricity price data providers.
 * Defines the standard interface that all electricity price providers must implement,
 * ensuring consistent data access patterns across different APIs (spot-hinta.fi, ENTSO-E, etc.).
 */
export interface IElectricityPriceProvider {
  /**
   * Retrieves electricity price for the current hour.
   *
   * @returns Promise resolving to current hour's price data.
   * @throws HttpException when API is unavailable or returns errors
   *
   * @example
   * ```typescript
   * const currentPrice = await provider.getCurrentPrice();
   * // Returns: { price: 0.15, startDate: "2024-07-15T07:00:00.000Z", endDate: "2024-07-15T08:00:00.000Z" }
   * ```
   */
  getCurrentPrice(): Promise<ElectricityPriceDto>;

  /**
   * Retrieves all electricity prices for the current day (24 hours).
   *
   * @returns Promise resolving to array of hourly price data for today.
   *          Typically contains 24 entries, one for each hour.
   * @throws HttpException when API is unavailable or returns errors
   *
   * @example
   * ```typescript
   * const todayPrices = await provider.getTodayPrices();
   * // Returns: Array of 24 ElectricityPriceDto objects for today
   * ```
   */
  getTodayPrices(): Promise<ElectricityPriceDto[]>;

  /**
   * Retrieves all electricity prices for tomorrow (24 hours).
   *
   * @returns Promise resolving to array of hourly price data for tomorrow.
   *          May return empty array if tomorrow's prices are not yet available.
   *          Typically contains 24 entries when available.
   * @throws HttpException when API is unavailable or returns errors
   *
   * @example
   * ```typescript
   * const tomorrowPrices = await provider.getTomorrowPrices();
   * // Returns: Array of 24 ElectricityPriceDto objects for tomorrow (when available)
   * ```
   */
  getTomorrowPrices(): Promise<ElectricityPriceDto[]>;

  /**
   * Retrieves all available future electricity prices starting from the current hour.
   * Combines today's remaining prices (including current hour) and tomorrow's prices if available.
   *
   * @returns Promise resolving to array of hourly price data from current hour onwards.
   *          Includes current hour as first entry, followed by remaining today's hours
   *          and tomorrow's hours if available. Array length varies based on availability.
   * @throws HttpException when API is unavailable or returns errors
   *
   * @example
   * ```typescript
   * // If current time is 14:00 and tomorrow's prices are available
   * const futurePrices = await provider.getFuturePrices();
   * // Returns: Array with ~34 entries (10 remaining today + 24 tomorrow)
   *
   * // If current time is 14:00 and tomorrow's prices are NOT available
   * const futurePrices = await provider.getFuturePrices();
   * // Returns: Array with ~10 entries (remaining today only)
   * ```
   */
  getFuturePrices(): Promise<ElectricityPriceDto[]>;
}
