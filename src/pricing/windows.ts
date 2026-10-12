import { PricePoint, QUARTER_MS } from './price-point';

const average = (prices: PricePoint[]): number =>
  prices.reduce((sum, price) => sum + price.price, 0) / prices.length;

/** A continuous run of 15-minute prices */
export interface PriceWindow {
  startTime: string;
  endTime: string;
  /** Average of the quarter prices in c/kWh, not rounded */
  priceAvg: number;
  prices: PricePoint[];
}

/**
 * Every window of `quarters` consecutive 15-minute prices, in time order.
 * Windows over a gap in the prices are left out.
 */
export function allWindows(
  prices: PricePoint[],
  quarters: number,
): PriceWindow[] {
  const windows: PriceWindow[] = [];
  let runStart = 0;
  for (let i = 0; i < prices.length; i++) {
    if (
      i > 0 &&
      Date.parse(prices[i - 1].endTime) !== Date.parse(prices[i].startTime)
    ) {
      runStart = i;
    }
    if (i - runStart + 1 >= quarters) {
      const slice = prices.slice(i - quarters + 1, i + 1);
      windows.push({
        startTime: slice[0].startTime,
        endTime: slice[slice.length - 1].endTime,
        priceAvg: average(slice),
        prices: slice,
      });
    }
  }
  return windows;
}

/**
 * Windows of `quarters` consecutive prices, cheapest first; on a tie the
 * earlier window comes first.
 */
export function cheapestWindows(
  prices: PricePoint[],
  quarters: number,
  limit = Infinity,
): PriceWindow[] {
  return allWindows(prices, quarters)
    .sort((a, b) => a.priceAvg - b.priceAvg)
    .slice(0, limit);
}

/**
 * The window of `quarters` prices starting at `start`, or undefined when a
 * price on the way is missing.
 */
export function windowAt(
  byStart: Map<number, PricePoint>,
  start: number,
  quarters: number,
): PriceWindow | undefined {
  const slice: PricePoint[] = [];
  for (let q = 0; q < quarters; q++) {
    const price = byStart.get(start + q * QUARTER_MS);
    if (!price) return undefined;
    slice.push(price);
  }
  return {
    startTime: slice[0].startTime,
    endTime: slice[slice.length - 1].endTime,
    priceAvg: average(slice),
    prices: slice,
  };
}

/**
 * Takes windows in the given order, skipping each one that overlaps a window
 * already taken. With windows cheapest first this gives the cheapest set.
 */
export function pickNonOverlapping(
  windows: PriceWindow[],
  limit: number,
): PriceWindow[] {
  const picked: PriceWindow[] = [];
  for (const candidate of windows) {
    if (picked.length === limit) break;
    const overlaps = picked.some(
      (window) =>
        candidate.startTime < window.endTime &&
        window.startTime < candidate.endTime,
    );
    if (!overlaps) picked.push(candidate);
  }
  return picked;
}
