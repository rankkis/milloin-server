/**
 * Electricity price category classification
 *
 * Categories are based on cents/kWh thresholds:
 * - VERY_CHEAP: < 2.5 c/kWh
 * - CHEAP: 2.5-5.0 c/kWh
 * - NORMAL: 5.0-10.0 c/kWh
 * - EXPENSIVE: 10.0-20.0 c/kWh
 * - VERY_EXPENSIVE: >= 20.0 c/kWh
 */
export enum PriceCategory {
  VERY_CHEAP = 'VERY_CHEAP',
  CHEAP = 'CHEAP',
  NORMAL = 'NORMAL',
  EXPENSIVE = 'EXPENSIVE',
  VERY_EXPENSIVE = 'VERY_EXPENSIVE',
}
