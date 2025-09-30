import { ElectricityPriceDto } from '../dto/electricity-price.dto';
import { PriceCategory } from '../../dto/price-category.enum';
import { TARIFF_CONFIG } from '../../config/tariff.config';

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
  /** Estimated total price including tariffs (cents/kWh) */
  estimatedTotalPrice: number;
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
 * Finds optimal consecutive time periods with the lowest average electricity prices.
 *
 * This utility function analyzes electricity price data to identify the cheapest
 * consecutive time slots of a specified duration. It's useful for optimizing
 * when to run high-energy appliances like washing machines, EV chargers, etc.
 *
 * @param prices - Array of electricity prices with start/end times
 * @param durationHours - Length of the desired period in hours (e.g., 2 for washing machine, 4 for EV charging)
 * @param maxResults - Maximum number of optimal periods to return (default: 5)
 * @returns Array of optimal periods sorted by price (cheapest first), limited to maxResults
 *
 * @example
 * ```typescript
 * const prices = await electricityService.getTodayPrices();
 * const optimalPeriods = findOptimalPeriod(prices, 2); // Find 2-hour periods
 * const cheapest = optimalPeriods[0]; // Get the cheapest 2-hour period
 * console.log(`Start charging at ${cheapest.startTime} for ${cheapest.price}¢/kWh`);
 * ```
 *
 * @remarks
 * - Only returns periods where all hours are consecutive (no gaps in time)
 * - Prices are converted from euros to cents and rounded to 2 decimal places
 * - Returns empty array if insufficient data is available
 * - Algorithm complexity: O(n * durationHours) where n is the number of price points
 */
export function findOptimalPeriod(
  prices: ElectricityPriceDto[],
  durationHours: number,
  maxResults = 5,
): OptimalPeriodResult[] {
  const optimalSlots: OptimalPeriodResult[] = [];

  // Find all possible consecutive time slots of the required duration
  for (let i = 0; i <= prices.length - durationHours; i++) {
    const slot = prices.slice(i, i + durationHours);

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
      const averagePrice =
        slot.reduce((sum, hour) => sum + hour.price, 0) / slot.length;
      const priceInCents = Math.round(averagePrice * 100 * 100) / 100; // Convert euros to cents and round to 2 decimal places

      // Calculate estimated total price using actual hourly prices + tariffs
      const totalPriceWithTariffs =
        slot.reduce((sum, hour) => {
          const hourPriceInCents = hour.price * 100; // Convert to cents
          return sum + hourPriceInCents + TARIFF_CONFIG.TOTAL_TARIFF_CENTS_KWH;
        }, 0) / slot.length;

      optimalSlots.push({
        startTime: slot[0].startDate,
        endTime: slot[slot.length - 1].endDate,
        priceAvg: priceInCents,
        priceCategory: calculatePriceCategory(priceInCents),
        estimatedTotalPrice: Math.round(totalPriceWithTariffs * 100) / 100, // Round to 2 decimal places
      });
    }
  }

  // Sort by price (cheapest first) and return top results
  return optimalSlots
    .sort((a, b) => a.priceAvg - b.priceAvg)
    .slice(0, maxResults);
}
