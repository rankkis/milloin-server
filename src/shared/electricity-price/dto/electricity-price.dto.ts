/**
 * Represents electricity price data for a 15-minute interval.
 * Used as the standardized format across all electricity price providers.
 *
 * Since October 1, 2025, Finnish electricity pricing uses 15-minute intervals.
 * Prices include 25.5% Finnish VAT for consumer-ready pricing.
 */
export interface ElectricityPriceDto {
  /**
   * Electricity price in euros per kWh, including 25.5% VAT.
   * Example: 0.0522 represents 5.22 cents per kWh
   */
  price: number;

  /**
   * Start time of the 15-minute pricing period in ISO 8601 format (UTC).
   * Example: "2025-10-03T07:00:00.000Z"
   */
  startDate: string;

  /**
   * End time of the 15-minute pricing period in ISO 8601 format (UTC).
   * Always startDate + 15 minutes.
   * Example: "2025-10-03T07:15:00.000Z"
   */
  endDate: string;
}
