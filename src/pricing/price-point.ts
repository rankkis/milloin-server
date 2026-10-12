export const QUARTER_MS = 15 * 60 * 1000;
export const HOUR_MS = 4 * QUARTER_MS;

/**
 * A 15-minute electricity price as the calculations use it: c/kWh including
 * 25.5 % VAT, not rounded. Times are UTC ISO 8601.
 */
export interface PricePoint {
  startTime: string;
  endTime: string;
  price: number;
}

/** Rounds for output; calculations keep full precision */
export const round2 = (value: number): number => Math.round(value * 100) / 100;

/** The start of the 15-minute interval `time` falls in */
export const quarterStart = (time: number): number =>
  Math.floor(time / QUARTER_MS) * QUARTER_MS;

/** Prices by start time, for looking up a given quarter */
export const byStartTime = (prices: PricePoint[]): Map<number, PricePoint> =>
  new Map(prices.map((price) => [Date.parse(price.startTime), price]));
