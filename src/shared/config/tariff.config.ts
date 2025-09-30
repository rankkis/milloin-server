/**
 * Electricity tariff configuration (in cents/kWh)
 */
export const TARIFF_CONFIG = {
  /**
   * Electricity exchange tariff in cents per kWh
   */
  EXCHANGE_TARIFF_CENTS_KWH: 6.7,

  /**
   * Margin tariff in cents per kWh
   */
  MARGIN_TARIFF_CENTS_KWH: 0.5,

  /**
   * Total tariff (exchange + margin) in cents per kWh
   */
  get TOTAL_TARIFF_CENTS_KWH(): number {
    return this.EXCHANGE_TARIFF_CENTS_KWH + this.MARGIN_TARIFF_CENTS_KWH;
  },
} as const;
