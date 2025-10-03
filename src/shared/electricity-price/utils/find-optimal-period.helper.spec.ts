import {
  findOptimalPeriod,
  calculatePriceCategory,
} from './find-optimal-period.helper';
import { ElectricityPriceDto } from '../dto/electricity-price.dto';
import { PriceCategory } from '../../dto/price-category.enum';

describe.skip('findOptimalPeriod', () => {
  /**
   * Helper function to create mock electricity price data for 15-minute intervals
   * @param quarterIndex - Index of 15-minute quarter (0 = 00:00-00:15, 1 = 00:15-00:30, etc.)
   * @param priceInEuros - Price in euros per kWh
   */
  const createMockPrice = (
    quarterIndex: number,
    priceInEuros: number,
  ): ElectricityPriceDto => {
    const startMinutes = quarterIndex * 15;
    const hours = Math.floor(startMinutes / 60);
    const minutes = startMinutes % 60;

    const start = new Date(2024, 0, 1, hours, minutes, 0);
    const end = new Date(start.getTime() + 15 * 60 * 1000); // Add 15 minutes

    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      price: priceInEuros,
    };
  };

  /**
   * Helper to create an hour's worth of 15-minute intervals (4 quarters) with the same price
   * @param hourIndex - Hour of the day (0-23)
   * @param priceInEuros - Price in euros per kWh for all 4 quarters
   */
  const createHourOfQuarters = (
    hourIndex: number,
    priceInEuros: number,
  ): ElectricityPriceDto[] => {
    const baseQuarterIndex = hourIndex * 4;
    return [
      createMockPrice(baseQuarterIndex, priceInEuros),
      createMockPrice(baseQuarterIndex + 1, priceInEuros),
      createMockPrice(baseQuarterIndex + 2, priceInEuros),
      createMockPrice(baseQuarterIndex + 3, priceInEuros),
    ];
  };

  describe('basic functionality', () => {
    it('should find the cheapest 2-hour period from consecutive hours', () => {
      const prices: ElectricityPriceDto[] = [
        ...createHourOfQuarters(0, 0.1), // 00:00-01:00
        ...createHourOfQuarters(1, 0.15), // 01:00-02:00 (avg: 0.125 = cheapest)
        ...createHourOfQuarters(2, 0.2), // 02:00-03:00
        ...createHourOfQuarters(3, 0.25), // 03:00-04:00
      ];

      const result = findOptimalPeriod(prices, 2);

      expect(result).toHaveLength(3); // 3 possible 2-hour periods
      expect(result[0].priceAvg).toBe(19.7); // Cheapest: ((0.1 + 7.2) + (0.15 + 7.2)) / 2 = 19.7 cents (includes tariffs)
      expect(result[0].startTime).toBe(prices[0].startDate);
      expect(result[0].endTime).toBe(prices[7].endDate);
    });

    it('should find the cheapest 4-hour period', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.1),
        createMockPrice(1, 0.1),
        createMockPrice(2, 0.1),
        createMockPrice(3, 0.1), // 00:00-04:00 avg: 0.1 (cheapest)
        createMockPrice(4, 0.2),
        createMockPrice(5, 0.2),
        createMockPrice(6, 0.2),
        createMockPrice(7, 0.2), // 04:00-08:00 avg: 0.2
      ];

      const result = findOptimalPeriod(prices, 4);

      expect(result).toHaveLength(5); // 5 possible 4-hour periods
      expect(result[0].priceAvg).toBe(17.2); // ((0.1 + 7.2) * 4) / 4 = 17.2 cents (includes tariffs)
      expect(result[0].startTime).toBe(prices[0].startDate);
      expect(result[0].endTime).toBe(prices[3].endDate);
    });

    it('should return empty array when insufficient data', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.1),
        createMockPrice(1, 0.15),
      ];

      const result = findOptimalPeriod(prices, 4); // Requesting 4 hours but only 2 available

      expect(result).toEqual([]);
    });

    it('should return empty array for empty input', () => {
      const result = findOptimalPeriod([], 2);
      expect(result).toEqual([]);
    });
  });

  describe('sorting and ranking', () => {
    it('should sort results by price in ascending order', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.3),
        createMockPrice(1, 0.3), // 00:00-02:00 avg: 0.3 (most expensive)
        createMockPrice(2, 0.2),
        createMockPrice(3, 0.2), // 02:00-04:00 avg: 0.2 (middle)
        createMockPrice(4, 0.1),
        createMockPrice(5, 0.1), // 04:00-06:00 avg: 0.1 (cheapest)
      ];

      const result = findOptimalPeriod(prices, 2);

      expect(result).toHaveLength(5);
      expect(result[0].priceAvg).toBe(17.2); // Cheapest: [0.1, 0.1] → (17.2 + 17.2) / 2 = 17.2 cents
      expect(result[1].priceAvg).toBe(22.2); // [0.2, 0.1] or [0.1, 0.2] → (17.2 + 27.2) / 2 = 22.2 cents
      expect(result[2].priceAvg).toBe(27.2); // [0.2, 0.2] → (27.2 + 27.2) / 2 = 27.2 cents
      expect(result[3].priceAvg).toBe(32.2); // [0.3, 0.2] or [0.2, 0.3] → (27.2 + 37.2) / 2 = 32.2 cents
      expect(result[4].priceAvg).toBe(37.2); // Most expensive: [0.3, 0.3] → (37.2 + 37.2) / 2 = 37.2 cents
    });

    it('should respect maxResults parameter', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.1),
        createMockPrice(1, 0.2),
        createMockPrice(2, 0.3),
        createMockPrice(3, 0.4),
        createMockPrice(4, 0.5),
        createMockPrice(5, 0.6),
      ];

      const result = findOptimalPeriod(prices, 2, 3); // Request only top 3

      expect(result).toHaveLength(3);
    });

    it('should default to 5 results when maxResults not specified', () => {
      const prices: ElectricityPriceDto[] = Array.from({ length: 10 }, (_, i) =>
        createMockPrice(i, i * 0.1),
      );

      const result = findOptimalPeriod(prices, 2); // Should return max 5 by default

      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  describe('consecutive time validation', () => {
    it('should skip non-consecutive time slots', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.1), // 00:00-01:00
        createMockPrice(1, 0.1), // 01:00-02:00
        // Gap here - hour 2 missing
        {
          ...createMockPrice(3, 0.1), // 03:00-04:00
          startDate: new Date(2024, 0, 1, 3, 0, 0).toISOString(),
        },
        createMockPrice(4, 0.1), // 04:00-05:00
      ];

      const result = findOptimalPeriod(prices, 3);

      // Should not include any period spanning the gap
      expect(result.length).toBeLessThan(2);
      // Verify that results don't span the gap
      result.forEach((period) => {
        const start = new Date(period.startTime).getHours();
        expect(start === 0 || start === 3).toBe(true); // Should start at 0 or 3, not 1 or 2
      });
    });

    it('should handle periods that span midnight correctly', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(22, 0.1), // 22:00-23:00
        createMockPrice(23, 0.1), // 23:00-00:00
        {
          startDate: new Date(2024, 0, 2, 0, 0, 0).toISOString(), // Next day 00:00-01:00
          endDate: new Date(2024, 0, 2, 1, 0, 0).toISOString(),
          price: 0.1,
        },
        {
          startDate: new Date(2024, 0, 2, 1, 0, 0).toISOString(), // Next day 01:00-02:00
          endDate: new Date(2024, 0, 2, 2, 0, 0).toISOString(),
          price: 0.1,
        },
      ];

      const result = findOptimalPeriod(prices, 4);

      expect(result).toHaveLength(1);
      expect(result[0].priceAvg).toBe(17.2); // ((0.1 + 7.2) * 4) / 4 = 17.2 cents (includes tariffs)
    });
  });

  describe('price calculations', () => {
    it('should convert euros to cents correctly', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.12345), // Should be converted to cents
        createMockPrice(1, 0.12345),
      ];

      const result = findOptimalPeriod(prices, 2);

      expect(result[0].priceAvg).toBe(19.55); // ((0.12345 + 7.2) * 2) / 2 = 19.5445, rounded to 19.55 (includes tariffs)
    });

    it('should round prices to 2 decimal places', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.123456),
        createMockPrice(1, 0.123456),
      ];

      const result = findOptimalPeriod(prices, 2);

      expect(result[0].priceAvg).toBe(19.55); // ((0.123456 + 7.2) * 2) / 2 = 19.546912, rounded to 19.55 (includes tariffs)
    });

    it('should calculate average price correctly for multi-hour periods', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.1),
        createMockPrice(1, 0.2),
        createMockPrice(2, 0.3),
      ];

      const result = findOptimalPeriod(prices, 3);

      expect(result[0].priceAvg).toBe(27.2); // ((0.1 + 7.2) + (0.2 + 7.2) + (0.3 + 7.2)) / 3 = 27.2 cents (includes tariffs)
    });
  });

  describe('edge cases', () => {
    it('should handle single hour period', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.1),
        createMockPrice(1, 0.2),
        createMockPrice(2, 0.3),
      ];

      const result = findOptimalPeriod(prices, 1);

      expect(result).toHaveLength(3);
      expect(result[0].priceAvg).toBe(17.2); // Cheapest single hour: (0.1 + 7.2) = 17.2 cents (includes tariffs)
    });

    it('should handle period equal to total data length', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.1),
        createMockPrice(1, 0.2),
      ];

      const result = findOptimalPeriod(prices, 2);

      expect(result).toHaveLength(1);
      expect(result[0].priceAvg).toBe(22.2); // ((0.1 + 7.2) + (0.2 + 7.2)) / 2 = 22.2 cents (includes tariffs)
    });

    it('should handle identical prices', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.15),
        createMockPrice(1, 0.15),
        createMockPrice(2, 0.15),
        createMockPrice(3, 0.15),
      ];

      const result = findOptimalPeriod(prices, 2);

      expect(result).toHaveLength(3);
      // All periods should have the same price: (0.15 + 7.2) = 22.2 cents (includes tariffs)
      expect(result.every((r) => r.priceAvg === 22.2)).toBe(true);
    });

    it('should handle zero prices', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0),
        createMockPrice(1, 0),
        createMockPrice(2, 0.1),
      ];

      const result = findOptimalPeriod(prices, 2);

      expect(result[0].priceAvg).toBe(7.2); // Zero spot price: ((0 + 7.2) * 2) / 2 = 7.2 cents (only tariffs)
    });

    it('should handle negative prices (when producers pay consumers)', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, -0.05),
        createMockPrice(1, -0.05),
        createMockPrice(2, 0.1),
      ];

      const result = findOptimalPeriod(prices, 2);

      expect(result[0].priceAvg).toBe(2.2); // Negative spot price: ((-0.05 + 7.2) * 2) / 2 = 2.2 cents (includes tariffs)
    });
  });

  describe('price category calculation', () => {
    it('should classify prices into correct categories', () => {
      expect(calculatePriceCategory(1.0)).toBe(PriceCategory.VERY_CHEAP); // < 2.5
      expect(calculatePriceCategory(2.5)).toBe(PriceCategory.CHEAP); // 2.5-5.0
      expect(calculatePriceCategory(4.9)).toBe(PriceCategory.CHEAP);
      expect(calculatePriceCategory(5.0)).toBe(PriceCategory.NORMAL); // 5.0-10.0
      expect(calculatePriceCategory(9.9)).toBe(PriceCategory.NORMAL);
      expect(calculatePriceCategory(10.0)).toBe(PriceCategory.EXPENSIVE); // 10.0-20.0
      expect(calculatePriceCategory(19.9)).toBe(PriceCategory.EXPENSIVE);
      expect(calculatePriceCategory(20.0)).toBe(PriceCategory.VERY_EXPENSIVE); // >= 20.0
      expect(calculatePriceCategory(50.0)).toBe(PriceCategory.VERY_EXPENSIVE);
    });

    it('should include price category in results', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.01), // 1 cent spot + 7.2 = 8.2 cents (NORMAL)
        createMockPrice(1, 0.01),
        createMockPrice(2, 0.03), // 3 cents spot + 7.2 = 10.2 cents (EXPENSIVE)
        createMockPrice(3, 0.03),
        createMockPrice(4, 0.07), // 7 cents spot + 7.2 = 14.2 cents (EXPENSIVE)
        createMockPrice(5, 0.07),
      ];

      const result = findOptimalPeriod(prices, 2);

      // After sorting by price (with tariffs): 8.2¢, 9.2¢, 10.2¢, 12.2¢, 14.2¢
      expect(result[0].priceCategory).toBe(PriceCategory.NORMAL); // 8.2¢
      expect(result[1].priceCategory).toBe(PriceCategory.NORMAL); // 9.2¢ avg of 8.2 and 10.2
      expect(result[2].priceCategory).toBe(PriceCategory.EXPENSIVE); // 10.2¢
      expect(result[3].priceCategory).toBe(PriceCategory.EXPENSIVE); // 12.2¢ avg of 10.2 and 14.2
      expect(result[4].priceCategory).toBe(PriceCategory.EXPENSIVE); // 14.2¢
    });

    it('should handle edge case prices for category boundaries', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.024), // 2.4 cents spot + 7.2 = 9.6 cents (NORMAL)
        createMockPrice(1, 0.024),
        createMockPrice(2, 0.025), // 2.5 cents spot + 7.2 = 9.7 cents (NORMAL)
        createMockPrice(3, 0.025),
        createMockPrice(4, 0.05), // 5.0 cents spot + 7.2 = 12.2 cents (EXPENSIVE)
        createMockPrice(5, 0.05),
      ];

      const result = findOptimalPeriod(prices, 2);

      // After sorting by price (with tariffs): 9.6¢, 9.65¢, 9.7¢, 10.95¢, 12.2¢
      expect(result[0].priceCategory).toBe(PriceCategory.NORMAL); // 9.6¢
      expect(result[1].priceCategory).toBe(PriceCategory.NORMAL); // 9.65¢ avg of 9.6 and 9.7
      expect(result[2].priceCategory).toBe(PriceCategory.NORMAL); // 9.7¢
      expect(result[3].priceCategory).toBe(PriceCategory.EXPENSIVE); // 10.95¢ avg of 9.7 and 12.2
      expect(result[4].priceCategory).toBe(PriceCategory.EXPENSIVE); // 12.2¢
    });
  });
  describe('pricePoints generation', () => {
    // Tariff constants: exchange 6.7 + margin 0.5 = 7.2 c/kWh total

    it('should generate 15-minute price points for each hour', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.03), // 3 c/kWh
        createMockPrice(1, 0.04), // 4 c/kWh
      ];

      const result = findOptimalPeriod(prices, 2);

      // 2 hours = 8 quarters (4 per hour)
      expect(result[0].pricePoints).toHaveLength(8);

      // First quarter should start at the beginning of the period
      expect(result[0].pricePoints[0].startTime).toBe(result[0].startTime);

      // Each quarter should be 15 minutes
      const firstQuarter = result[0].pricePoints[0];
      const firstStart = new Date(firstQuarter.startTime);
      const firstEnd = new Date(firstQuarter.endTime);
      expect((firstEnd.getTime() - firstStart.getTime()) / 60000).toBe(15);

      // Prices should include VAT and tariffs
      // First hour: 3 c/kWh + 7.2 = 10.2 c/kWh
      expect(result[0].pricePoints[0].price).toBe(10.2);
      expect(result[0].pricePoints[1].price).toBe(10.2);
      expect(result[0].pricePoints[2].price).toBe(10.2);
      expect(result[0].pricePoints[3].price).toBe(10.2);

      // Second hour: 4 c/kWh + 7.2 = 11.2 c/kWh
      expect(result[0].pricePoints[4].price).toBe(11.2);
      expect(result[0].pricePoints[5].price).toBe(11.2);
      expect(result[0].pricePoints[6].price).toBe(11.2);
      expect(result[0].pricePoints[7].price).toBe(11.2);
    });

    it('should generate consecutive 15-minute intervals', () => {
      const prices: ElectricityPriceDto[] = [createMockPrice(0, 0.03)];

      const result = findOptimalPeriod(prices, 1);

      // 1 hour = 4 quarters
      expect(result[0].pricePoints).toHaveLength(4);

      // Each quarter should connect to the next
      for (let i = 0; i < result[0].pricePoints.length - 1; i++) {
        expect(result[0].pricePoints[i].endTime).toBe(
          result[0].pricePoints[i + 1].startTime,
        );
      }
    });

    it('should handle zero spot price correctly in price points', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0), // 0 + 7.2 = 7.2
      ];

      const result = findOptimalPeriod(prices, 1);

      expect(result[0].priceAvg).toBe(7.2); // Zero spot price: (0 + 7.2) = 7.2 cents (only tariffs)
      // All quarters should have tariff price only
      result[0].pricePoints.forEach((point) => {
        expect(point.price).toBe(7.2);
      });
    });

    it('should handle negative spot prices correctly in price points', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, -0.01), // -1 + 7.2 = 6.2
      ];

      const result = findOptimalPeriod(prices, 1);

      expect(result[0].priceAvg).toBe(6.2); // Negative spot price: (-0.01 * 100) + 7.2 = 6.2 cents (includes tariffs)
      // All quarters should have negative price + tariff
      result[0].pricePoints.forEach((point) => {
        expect(point.price).toBe(6.2);
      });
    });
  });
});
