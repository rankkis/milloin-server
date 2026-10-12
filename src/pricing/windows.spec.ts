import { PricePoint, QUARTER_MS, byStartTime } from './price-point';
import { PriceCategory, priceCategory } from './price-category';
import {
  allWindows,
  cheapestWindows,
  pickNonOverlapping,
  windowAt,
} from './windows';
import { hourlyPrices } from './hours';

const BASE = Date.parse('2025-10-01T00:00:00.000Z');

/** Consecutive 15-minute prices in c/kWh from BASE + startQuarter */
const quarters = (cents: number[], startQuarter = 0): PricePoint[] =>
  cents.map((price, i) => {
    const start = BASE + (startQuarter + i) * QUARTER_MS;
    return {
      price,
      startTime: new Date(start).toISOString(),
      endTime: new Date(start + QUARTER_MS).toISOString(),
    };
  });

/** Whole hours of 15-minute prices, one price per hour */
const hours = (cents: number[], startHour = 0): PricePoint[] =>
  quarters(
    cents.flatMap((p) => [p, p, p, p]),
    startHour * 4,
  );

describe('cheapestWindows', () => {
  it('finds the cheapest 2-hour window', () => {
    const [best] = cheapestWindows(hours([20, 5, 6, 30]), 8);

    expect(best.startTime).toBe('2025-10-01T01:00:00.000Z');
    expect(best.endTime).toBe('2025-10-01T03:00:00.000Z');
    expect(best.priceAvg).toBe(5.5);
    expect(best.prices).toHaveLength(8);
  });

  it('evaluates every quarter-hour start, not only full hours', () => {
    const prices = quarters([...Array(5).fill(20), ...Array(4).fill(1), 20]);

    const [best] = cheapestWindows(prices, 4);

    expect(best.startTime).toBe('2025-10-01T01:15:00.000Z');
    expect(best.priceAvg).toBe(1);
  });

  it('returns one window per possible start, up to the limit', () => {
    const prices = hours([10, 10, 10]);

    expect(cheapestWindows(prices, 8)).toHaveLength(5);
    expect(cheapestWindows(prices, 8, 2)).toHaveLength(2);
    expect(cheapestWindows(hours([10]), 8)).toEqual([]);
    expect(cheapestWindows([], 4)).toEqual([]);
  });

  it('puts the earlier window first on a tie', () => {
    const result = cheapestWindows(hours([3, 7, 3]), 4);

    expect(result[0].startTime).toBe('2025-10-01T00:00:00.000Z');
    expect(result[1].startTime).toBe('2025-10-01T02:00:00.000Z');
  });

  it('keeps full precision in the average', () => {
    const [best] = cheapestWindows(
      quarters([1.2345, 1.2345, 1.2345, 1.2345]),
      4,
    );

    expect(best.priceAvg).toBeCloseTo(1.2345, 10);
  });

  it('handles zero and negative prices', () => {
    const result = cheapestWindows(hours([0, -2, 5]), 4);

    expect(result[0].priceAvg).toBe(-2);
    expect(result.some((window) => window.priceAvg === 0)).toBe(true);
  });
});

describe('allWindows', () => {
  it('skips windows over a gap in time', () => {
    const prices = [...hours([1]), ...hours([1], 5), ...hours([50], 6)];

    const result = allWindows(prices, 8);

    expect(result).toHaveLength(1);
    expect(result[0].startTime).toBe('2025-10-01T05:00:00.000Z');
  });

  it('runs over midnight', () => {
    const [best] = cheapestWindows(hours([30, 2, 2, 30], 22), 8);

    expect(best.startTime).toBe('2025-10-01T23:00:00.000Z');
    expect(best.endTime).toBe('2025-10-02T01:00:00.000Z');
  });
});

describe('windowAt', () => {
  it('returns the window starting at a time, or nothing over a gap', () => {
    const prices = [...hours([4, 8]), ...hours([1], 3)];
    const byStart = byStartTime(prices);

    expect(windowAt(byStart, BASE, 8)?.priceAvg).toBe(6);
    expect(windowAt(byStart, BASE + 4 * QUARTER_MS, 8)).toBeUndefined();
  });
});

describe('pickNonOverlapping', () => {
  it('takes the cheapest windows that do not overlap', () => {
    const picked = pickNonOverlapping(
      cheapestWindows(hours([10, 9, 2, 3, 8, 1, 1, 9]), 8),
      3,
    );

    expect(picked.map((w) => [w.startTime, w.priceAvg])).toEqual([
      ['2025-10-01T05:00:00.000Z', 1],
      ['2025-10-01T02:00:00.000Z', 2.5],
      ['2025-10-01T00:00:00.000Z', 9.5],
    ]);
  });
});

describe('hourlyPrices', () => {
  it('averages quarters by clock hour', () => {
    expect(hourlyPrices(quarters([1, 2, 3, 4, 10, 10]))).toEqual([
      {
        startTime: '2025-10-01T00:00:00.000Z',
        endTime: '2025-10-01T01:00:00.000Z',
        priceAvg: 2.5,
      },
      {
        startTime: '2025-10-01T01:00:00.000Z',
        endTime: '2025-10-01T02:00:00.000Z',
        priceAvg: 10,
      },
    ]);
  });
});

describe('priceCategory', () => {
  it.each([
    [-1, PriceCategory.VERY_CHEAP],
    [2.49, PriceCategory.VERY_CHEAP],
    [2.499, PriceCategory.CHEAP],
    [2.5, PriceCategory.CHEAP],
    [4.99, PriceCategory.CHEAP],
    [5, PriceCategory.NORMAL],
    [9.99, PriceCategory.NORMAL],
    [10, PriceCategory.EXPENSIVE],
    [19.99, PriceCategory.EXPENSIVE],
    [20, PriceCategory.VERY_EXPENSIVE],
  ])('classifies %p c/kWh as %s', (price, category) => {
    expect(priceCategory(price)).toBe(category);
  });
});
