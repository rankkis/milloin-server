/**
 * Represents electricity price data for a specific time period.
 * Used as the standardized format across all electricity price providers.
 */
export interface ElectricityPriceDto {
  /**
   * Electricity price in euros per MWh, including taxes.
   * Example: 0.15 represents 15 cents per kWh or 150 euros per MWh
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
