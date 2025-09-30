import {
  findOptimalPeriod,
  calculatePriceCategory,
} from './find-optimal-period.helper';
import { ElectricityPriceDto } from '../dto/electricity-price.dto';
import { PriceCategory } from '../../dto/price-category.enum';

describe('findOptimalPeriod', () => {
  /**
   * Helper function to create mock electricity price data
   */
  const createMockPrice = (
    startHour: number,
    priceInEuros: number,
  ): ElectricityPriceDto => {
    const start = new Date(2024, 0, 1, startHour, 0, 0);
    const end = new Date(2024, 0, 1, startHour + 1, 0, 0);
    return {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      price: priceInEuros,
    };
  };

  describe('basic functionality', () => {
    it('should find the cheapest 2-hour period from consecutive hours', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.1), // 00:00-01:00
        createMockPrice(1, 0.15), // 01:00-02:00 (avg: 0.125 = cheapest)
        createMockPrice(2, 0.2), // 02:00-03:00
        createMockPrice(3, 0.25), // 03:00-04:00
      ];

      const result = findOptimalPeriod(prices, 2);

      expect(result).toHaveLength(3); // 3 possible 2-hour periods
      expect(result[0].priceAvg).toBe(12.5); // Cheapest: (0.1 + 0.15) / 2 * 100 = 12.5 cents
      expect(result[0].startTime).toBe(prices[0].startDate);
      expect(result[0].endTime).toBe(prices[1].endDate);
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
      expect(result[0].priceAvg).toBe(10); // (0.1 * 4) / 4 * 100 = 10 cents
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
      expect(result[0].priceAvg).toBe(10); // Cheapest
      expect(result[1].priceAvg).toBe(15);
      expect(result[2].priceAvg).toBe(20);
      expect(result[3].priceAvg).toBe(25);
      expect(result[4].priceAvg).toBe(30); // Most expensive
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
      expect(result[0].priceAvg).toBe(10);
    });
  });

  describe('price calculations', () => {
    it('should convert euros to cents correctly', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.12345), // Should be converted to cents
        createMockPrice(1, 0.12345),
      ];

      const result = findOptimalPeriod(prices, 2);

      expect(result[0].priceAvg).toBe(12.35); // 0.12345 * 100 = 12.345, rounded to 12.35
    });

    it('should round prices to 2 decimal places', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.123456),
        createMockPrice(1, 0.123456),
      ];

      const result = findOptimalPeriod(prices, 2);

      expect(result[0].priceAvg).toBe(12.35); // Should round to 2 decimals
    });

    it('should calculate average price correctly for multi-hour periods', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.1),
        createMockPrice(1, 0.2),
        createMockPrice(2, 0.3),
      ];

      const result = findOptimalPeriod(prices, 3);

      expect(result[0].priceAvg).toBe(20); // ((0.1 + 0.2 + 0.3) / 3) * 100 = 20 cents
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
      expect(result[0].priceAvg).toBe(10); // Cheapest single hour
    });

    it('should handle period equal to total data length', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.1),
        createMockPrice(1, 0.2),
      ];

      const result = findOptimalPeriod(prices, 2);

      expect(result).toHaveLength(1);
      expect(result[0].priceAvg).toBe(15); // (0.1 + 0.2) / 2 * 100
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
      // All periods should have the same price
      expect(result.every((r) => r.priceAvg === 15)).toBe(true);
    });

    it('should handle zero prices', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0),
        createMockPrice(1, 0),
        createMockPrice(2, 0.1),
      ];

      const result = findOptimalPeriod(prices, 2);

      expect(result[0].priceAvg).toBe(0); // Zero should be handled correctly
    });

    it('should handle negative prices (when producers pay consumers)', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, -0.05),
        createMockPrice(1, -0.05),
        createMockPrice(2, 0.1),
      ];

      const result = findOptimalPeriod(prices, 2);

      expect(result[0].priceAvg).toBe(-5); // Negative prices should work correctly
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
        createMockPrice(0, 0.01), // 1 cent
        createMockPrice(1, 0.01), // avg 1 cent (VERY_CHEAP)
        createMockPrice(2, 0.03), // avg 2 cents (VERY_CHEAP)
        createMockPrice(3, 0.03), // avg 3 cents (CHEAP)
        createMockPrice(4, 0.07), // avg 5 cents (NORMAL)
        createMockPrice(5, 0.07), // avg 7 cents (NORMAL)
      ];

      const result = findOptimalPeriod(prices, 2);

      // After sorting by price: 1¢ (VERY_CHEAP), 2¢ (VERY_CHEAP), 3¢ (CHEAP), 5¢ (NORMAL), 7¢ (NORMAL)
      expect(result[0].priceCategory).toBe(PriceCategory.VERY_CHEAP); // 1¢
      expect(result[1].priceCategory).toBe(PriceCategory.VERY_CHEAP); // 2¢
      expect(result[2].priceCategory).toBe(PriceCategory.CHEAP); // 3¢
      expect(result[3].priceCategory).toBe(PriceCategory.NORMAL); // 5¢
      expect(result[4].priceCategory).toBe(PriceCategory.NORMAL); // 7¢
    });

    it('should handle edge case prices for category boundaries', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.024),
        createMockPrice(1, 0.024), // avg 2.4 c/kWh - VERY_CHEAP
        createMockPrice(2, 0.025),
        createMockPrice(3, 0.025), // avg 2.5 c/kWh - CHEAP
        createMockPrice(4, 0.05),
        createMockPrice(5, 0.05), // avg 5.0 c/kWh - NORMAL
      ];

      const result = findOptimalPeriod(prices, 2);

      // After sorting by price: 2.4¢ (VERY_CHEAP), 2.45¢ (VERY_CHEAP), 2.5¢ (CHEAP), ..., 5.0¢ (NORMAL)
      expect(result[0].priceCategory).toBe(PriceCategory.VERY_CHEAP); // 2.4¢
      expect(result[1].priceCategory).toBe(PriceCategory.VERY_CHEAP); // 2.45¢ (avg of 2.4 and 2.5)
      expect(result[2].priceCategory).toBe(PriceCategory.CHEAP); // 2.5¢
      // Skip result[3] which is 3.75¢ (avg of 2.5 and 5.0)
      expect(result[4].priceCategory).toBe(PriceCategory.NORMAL); // 5.0¢
    });
  });
  describe('estimated total price calculation', () => {
    // Tariff constants: exchange 6.7 + margin 0.5 = 7.2 c/kWh total

    it('should calculate total price with tariffs for single period', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.03), // 3 c/kWh
        createMockPrice(1, 0.03), // 3 c/kWh
      ];

      const result = findOptimalPeriod(prices, 2);

      // Each hour: 3 + 7.2 = 10.2 c/kWh
      // Average: 10.2 c/kWh
      expect(result[0].estimatedTotalPrice).toBe(10.2);
    });

    it('should calculate total price using actual hourly prices, not average', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.02), // 2 c/kWh -> 2 + 7.2 = 9.2
        createMockPrice(1, 0.04), // 4 c/kWh -> 4 + 7.2 = 11.2
      ];

      const result = findOptimalPeriod(prices, 2);

      // Average spot price: 3 c/kWh
      expect(result[0].priceAvg).toBe(3);
      // Total with tariffs: (9.2 + 11.2) / 2 = 10.2 c/kWh
      expect(result[0].estimatedTotalPrice).toBe(10.2);
    });

    it('should calculate correct total price for 4-hour period', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.01), // 1 + 7.2 = 8.2
        createMockPrice(1, 0.02), // 2 + 7.2 = 9.2
        createMockPrice(2, 0.03), // 3 + 7.2 = 10.2
        createMockPrice(3, 0.04), // 4 + 7.2 = 11.2
      ];

      const result = findOptimalPeriod(prices, 4);

      // Average spot: (1 + 2 + 3 + 4) / 4 = 2.5 c/kWh
      expect(result[0].priceAvg).toBe(2.5);
      // Average total: (8.2 + 9.2 + 10.2 + 11.2) / 4 = 9.7 c/kWh
      expect(result[0].estimatedTotalPrice).toBe(9.7);
    });

    it('should round estimated total price to 2 decimal places', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0.01111), // Creates decimal precision scenario
        createMockPrice(1, 0.02222),
      ];

      const result = findOptimalPeriod(prices, 2);

      // Result should be rounded to 2 decimals
      expect(result[0].estimatedTotalPrice).toBeCloseTo(8.87, 2);
    });

    it('should handle zero spot price correctly', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, 0), // 0 + 7.2 = 7.2
        createMockPrice(1, 0), // 0 + 7.2 = 7.2
      ];

      const result = findOptimalPeriod(prices, 2);

      expect(result[0].priceAvg).toBe(0);
      expect(result[0].estimatedTotalPrice).toBe(7.2); // Only tariffs
    });

    it('should handle negative spot prices correctly', () => {
      const prices: ElectricityPriceDto[] = [
        createMockPrice(0, -0.01), // -1 + 7.2 = 6.2
        createMockPrice(1, -0.01), // -1 + 7.2 = 6.2
      ];

      const result = findOptimalPeriod(prices, 2);

      expect(result[0].priceAvg).toBe(-1);
      expect(result[0].estimatedTotalPrice).toBe(6.2); // Tariffs offset negative price
    });
  });
});
