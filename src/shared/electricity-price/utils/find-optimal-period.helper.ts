import { ElectricityPriceDto } from '../dto/electricity-price.dto';
import { PriceCategory } from '../../dto/price-category.enum';
import { TARIFF_CONFIG } from '../../config/tariff.config';
import { PricePointDto } from '../../dto/optimal-time.dto';

/**
 * Result of finding optimal time periods for electricity consumption
 */
export interface OptimalPeriodResult {
  /** ISO 8601 start time of the optimal period */
  startTime: string;
  /** ISO 8601 end time of the optimal period */
  endTime: string;
  /** Average electricity price for this period in cents/kWh */
  priceAvg: number;
  /** Price category classification */
  priceCategory: PriceCategory;
  /** Array of price points at 15-minute intervals between startTime and endTime */
  pricePoints: PricePointDto[];
}

/**
 * Calculate price category based on cents/kWh thresholds
 *
 * @param priceInCents - Price in cents per kWh
 * @returns Price category classification
 */
export function calculatePriceCategory(priceInCents: number): PriceCategory {
  if (priceInCents < 2.5) return PriceCategory.VERY_CHEAP;
  if (priceInCents < 5.0) return PriceCategory.CHEAP;
  if (priceInCents < 10.0) return PriceCategory.NORMAL;
  if (priceInCents < 20.0) return PriceCategory.EXPENSIVE;
  return PriceCategory.VERY_EXPENSIVE;
}

/**
 * Converts 15-minute electricity price data to price points.
 * Since October 1, 2025, prices are already in 15-minute intervals from ENTSO-E.
 * Note: Tariffs are NOT included - frontend handles total cost estimations.
 *
 * @param prices - Array of 15-minute electricity prices
 * @returns Array of 15-minute price points with VAT included (in cents/kWh)
 */
function convertToPricePoints(prices: ElectricityPriceDto[]): PricePointDto[] {
  return prices.map((price) => {
    const priceInCents = price.price * 100;

    return {
      startTime: price.startDate,
      endTime: price.endDate,
      price: Math.round(priceInCents * 100) / 100, // Round to 2 decimal places
    };
  });
}

/**
 * Finds optimal consecutive time periods with the lowest average electricity prices.
 *
 * This utility function analyzes 15-minute electricity price data to identify the cheapest
 * consecutive time slots of a specified duration. It's useful for optimizing
 * when to run high-energy appliances like washing machines, EV chargers, etc.
 *
 * @param prices - Array of 15-minute electricity prices with start/end times
 * @param durationHours - Length of the desired period in hours (e.g., 2 for washing machine, 4 for EV charging)
 * @param maxResults - Maximum number of optimal periods to return (default: 5)
 * @returns Array of optimal periods sorted by price (cheapest first), limited to maxResults
 *
 * @example
 * ```typescript
 * const prices = await electricityService.getTodayPrices();
 * const optimalPeriods = findOptimalPeriod(prices, 2); // Find 2-hour periods
 * const cheapest = optimalPeriods[0]; // Get the cheapest 2-hour period
 * console.log(`Start at ${cheapest.startTime} for ${cheapest.priceAvg}¢/kWh`);
 * ```
 *
 * @remarks
 * - Works with 15-minute price intervals (4 intervals per hour)
 * - Only returns periods where all intervals are consecutive (no gaps in time)
 * - Prices are converted from euros to cents and rounded to 2 decimal places
 * - Returns empty array if insufficient data is available
 * - Algorithm complexity: O(n * quarters) where n is the number of 15-min intervals
 */
export function findOptimalPeriod(
  prices: ElectricityPriceDto[],
  durationHours: number,
  maxResults = 5,
): OptimalPeriodResult[] {
  const optimalSlots: OptimalPeriodResult[] = [];
  const quartersNeeded = durationHours * 4; // 4 quarters (15-min intervals) per hour

  // Find all possible consecutive time slots of the required duration
  for (let i = 0; i <= prices.length - quartersNeeded; i++) {
    const slot = prices.slice(i, i + quartersNeeded);

    // Check if the slot is consecutive (no gaps in time)
    let isConsecutive = true;
    for (let j = 1; j < slot.length; j++) {
      const prevEndTime = new Date(slot[j - 1].endDate).getTime();
      const currentStartTime = new Date(slot[j].startDate).getTime();
      if (prevEndTime !== currentStartTime) {
        isConsecutive = false;
        break;
      }
    }

    if (isConsecutive) {
      // Convert to price points with tariffs
      const pricePoints = convertToPricePoints(slot);

      // Calculate average price based on price points (includes VAT and tariffs)
      const priceAvg =
        pricePoints.reduce((sum, point) => sum + point.price, 0) /
        pricePoints.length;
      const priceAvgRounded = Math.round(priceAvg * 100) / 100; // Round to 2 decimal places

      optimalSlots.push({
        startTime: slot[0].startDate,
        endTime: slot[slot.length - 1].endDate,
        priceAvg: priceAvgRounded,
        priceCategory: calculatePriceCategory(priceAvgRounded),
        pricePoints,
      });
    }
  }

  // Sort by price (cheapest first) and return top results
  return optimalSlots
    .sort((a, b) => a.priceAvg - b.priceAvg)
    .slice(0, maxResults);
}
