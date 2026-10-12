import { HOUR_MS, PricePoint } from './price-point';

/** The average of one clock hour's 15-minute prices */
export interface HourlyPrice {
  startTime: string;
  endTime: string;
  /** c/kWh, not rounded */
  priceAvg: number;
}

/**
 * Averages 15-minute prices by clock hour, in time order. Finnish clock
 * hours start on whole UTC hours, so quarters are grouped by UTC hour; an
 * hour with missing quarters averages the ones it has.
 */
export function hourlyPrices(prices: PricePoint[]): HourlyPrice[] {
  const hours = new Map<number, number[]>();
  for (const price of prices) {
    const hourStart =
      Math.floor(Date.parse(price.startTime) / HOUR_MS) * HOUR_MS;
    hours.set(hourStart, [...(hours.get(hourStart) ?? []), price.price]);
  }
  return [...hours.entries()]
    .sort(([a], [b]) => a - b)
    .map(([hourStart, cents]) => ({
      startTime: new Date(hourStart).toISOString(),
      endTime: new Date(hourStart + HOUR_MS).toISOString(),
      priceAvg: cents.reduce((sum, value) => sum + value, 0) / cents.length,
    }));
}
