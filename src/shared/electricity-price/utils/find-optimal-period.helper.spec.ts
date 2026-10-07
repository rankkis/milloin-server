import {
  findOptimalPeriod,
  calculatePriceCategory,
} from './find-optimal-period.helper';
import { ElectricityPriceDto } from '../dto/electricity-price.dto';
import { PriceCategory } from '../../dto/price-category.enum';

const QUARTER_MS = 15 * 60 * 1000;
const BASE = new Date('2025-10-01T00:00:00.000Z').getTime();

/**
 * Creates consecutive 15-minute prices starting from BASE.
 * @param pricesInEuros - One price (EUR/kWh) per quarter
 * @param startQuarter - Quarter index of the first price (0 = 00:00Z)
 */
const quarters = (
  pricesInEuros: number[],
  startQuarter = 0,
): ElectricityPriceDto[] =>
  pricesInEuros.map((price, i) => {
    const start = BASE + (startQuarter + i) * QUARTER_MS;
    return {
      price,
      startDate: new Date(start).toISOString(),
      endDate: new Date(start + QUARTER_MS).toISOString(),
    };
  });

/** Creates whole hours of 15-minute prices, one price per hour */
const hours = (pricesInEuros: number[], startHour = 0): ElectricityPriceDto[] =>
  quarters(
    pricesInEuros.flatMap((p) => [p, p, p, p]),
    startHour * 4,
  );

describe('findOptimalPeriod', () => {
  describe('basic functionality', () => {
    it('finds the cheapest 2-hour period', () => {
      const prices = hours([0.2, 0.05, 0.06, 0.3]);

      const [best] = findOptimalPeriod(prices, 2);

      expect(best.startTime).toBe('2025-10-01T01:00:00.000Z');
      expect(best.endTime).toBe('2025-10-01T03:00:00.000Z');
      expect(best.priceAvg).toBe(5.5);
    });

    it('evaluates every quarter-hour start, not only full hours', () => {
      // Cheap block starts at 01:15
      const prices = quarters([
        ...Array(5).fill(0.2),
        ...Array(4).fill(0.01),
        0.2,
        0.2,
      ]);

      const [best] = findOptimalPeriod(prices, 1);

      expect(best.startTime).toBe('2025-10-01T01:15:00.000Z');
      expect(best.endTime).toBe('2025-10-01T02:15:00.000Z');
      expect(best.priceAvg).toBe(1);
    });

    it('returns one candidate per possible start quarter, up to maxResults', () => {
      const prices = hours([0.1, 0.1, 0.1]); // 12 quarters, 2-hour window = 8

      expect(findOptimalPeriod(prices, 2, 100)).toHaveLength(5);
      expect(findOptimalPeriod(prices, 2)).toHaveLength(5);
      expect(findOptimalPeriod(prices, 2, 2)).toHaveLength(2);
    });

    it('returns an empty array when there is not enough data', () => {
      expect(findOptimalPeriod(hours([0.1]), 2)).toEqual([]);
      expect(findOptimalPeriod([], 1)).toEqual([]);
    });
  });

  describe('sorting', () => {
    it('sorts results by average price, cheapest first', () => {
      const prices = hours([0.3, 0.1, 0.2, 0.05]);

      const result = findOptimalPeriod(prices, 1, 20);
      const avgs = result.map((r) => r.priceAvg);

      expect(avgs).toEqual([...avgs].sort((a, b) => a - b));
      expect(result[0].startTime).toBe('2025-10-01T03:00:00.000Z');
    });
  });

  describe('consecutive time validation', () => {
    it('skips windows that contain a gap in time', () => {
      // 00:00-01:00 cheap, then a gap, then 05:00-06:00 cheap
      const prices = [
        ...hours([0.01]),
        ...hours([0.01], 5),
        ...hours([0.5], 6),
      ];

      const result = findOptimalPeriod(prices, 2, 100);

      // Only windows fully inside 05:00-07:00 are consecutive
      expect(result).toHaveLength(1);
      expect(result[0].startTime).toBe('2025-10-01T05:00:00.000Z');
    });

    it('handles periods spanning midnight', () => {
      const prices = hours([0.3, 0.02, 0.02, 0.3], 22); // 22:00 to 02:00

      const [best] = findOptimalPeriod(prices, 2);

      expect(best.startTime).toBe('2025-10-01T23:00:00.000Z');
      expect(best.endTime).toBe('2025-10-02T01:00:00.000Z');
    });
  });

  describe('price calculations', () => {
    it('converts euros to cents without adding tariffs', () => {
      const [best] = findOptimalPeriod(hours([0.0523]), 1);

      expect(best.priceAvg).toBe(5.23);
      best.pricePoints.forEach((p) => expect(p.price).toBe(5.23));
    });

    it('rounds prices to 2 decimal places', () => {
      const [best] = findOptimalPeriod(
        quarters([0.012345, 0.012345, 0.012345, 0.012345]),
        1,
      );

      expect(best.priceAvg).toBe(1.23);
    });

    it('averages quarter prices over the period', () => {
      const [best] = findOptimalPeriod(quarters([0.01, 0.02, 0.03, 0.04]), 1);

      expect(best.priceAvg).toBe(2.5);
    });

    it('handles zero and negative prices', () => {
      const result = findOptimalPeriod(hours([0, -0.02, 0.05]), 1, 20);

      expect(result[0].priceAvg).toBe(-2);
      expect(result[0].priceCategory).toBe(PriceCategory.VERY_CHEAP);
      expect(result.some((r) => r.priceAvg === 0)).toBe(true);
    });
  });

  describe('price points', () => {
    it('returns one consecutive 15-minute price point per quarter in the period', () => {
      const [best] = findOptimalPeriod(hours([0.05, 0.06]), 2);

      expect(best.pricePoints).toHaveLength(8);
      best.pricePoints.forEach((point, i) => {
        if (i > 0) {
          expect(point.startTime).toBe(best.pricePoints[i - 1].endTime);
        }
        expect(
          new Date(point.endTime).getTime() -
            new Date(point.startTime).getTime(),
        ).toBe(QUARTER_MS);
      });
      expect(best.pricePoints[0].startTime).toBe(best.startTime);
      expect(best.pricePoints[7].endTime).toBe(best.endTime);
    });
  });
});

describe('calculatePriceCategory', () => {
  it.each([
    [-1, PriceCategory.VERY_CHEAP],
    [2.49, PriceCategory.VERY_CHEAP],
    [2.5, PriceCategory.CHEAP],
    [4.99, PriceCategory.CHEAP],
    [5, PriceCategory.NORMAL],
    [9.99, PriceCategory.NORMAL],
    [10, PriceCategory.EXPENSIVE],
    [19.99, PriceCategory.EXPENSIVE],
    [20, PriceCategory.VERY_EXPENSIVE],
  ])('classifies %p c/kWh as %s', (price, category) => {
    expect(calculatePriceCategory(price)).toBe(category);
  });
});
