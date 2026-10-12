import { round2 } from './price-point';

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

/**
 * The category of a price in c/kWh, judged on the price rounded to cents as
 * it is shown, so 2.499 is CHEAP like the 2.5 it displays as.
 */
export function priceCategory(cents: number): PriceCategory {
  const shown = round2(cents);
  if (shown < 2.5) return PriceCategory.VERY_CHEAP;
  if (shown < 5.0) return PriceCategory.CHEAP;
  if (shown < 10.0) return PriceCategory.NORMAL;
  if (shown < 20.0) return PriceCategory.EXPENSIVE;
  return PriceCategory.VERY_EXPENSIVE;
}
