/**
 * Represents electricity price data for a specific time period.
 * Used as the standardized format across all electricity price providers.
 *
 * Prices include 25.5% Finnish VAT for consumer-ready pricing.
 */
export interface ElectricityPriceDto {
  /**
   * Electricity price in euros per kWh, including 25.5% VAT.
   * Example: 0.0522 represents 5.22 cents per kWh
   */
  price: number;

  /**
   * Start time of the pricing period in ISO 8601 format (UTC).
   * Example: "2024-07-15T07:00:00.000Z"
   */
  startDate: string;

  /**
   * End time of the pricing period in ISO 8601 format (UTC).
   * Typically startDate + 1 hour for hourly pricing.
   * Example: "2024-07-15T08:00:00.000Z"
   */
  endDate: string;
}
