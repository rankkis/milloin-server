import { helsinkiParts } from '../shared/utils/helsinki-time.helper';
import { PriceCategory } from './price-category';

const QUINTILES = [
  PriceCategory.VERY_CHEAP,
  PriceCategory.CHEAP,
  PriceCategory.NORMAL,
  PriceCategory.EXPENSIVE,
  PriceCategory.VERY_EXPENSIVE,
];

const finnishDay = (time: string): string => {
  const { year, month, day } = helsinkiParts(new Date(time));
  return `${year}-${month}-${day}`;
};

/**
 * Each price's category among the prices of its own Finnish day: the
 * cheapest fifth of the day is VERY_CHEAP, the dearest fifth VERY_EXPENSIVE.
 * Equal prices share a category. Unlike the fixed thresholds this always
 * marks some hours cheap, which suits "run in the cheap hours" automations.
 */
export function dayCategories(
  prices: { startTime: string; price: number }[],
): PriceCategory[] {
  const days = new Map<string, number[]>();
  prices.forEach((price, i) => {
    const day = finnishDay(price.startTime);
    days.set(day, [...(days.get(day) ?? []), i]);
  });

  const categories: PriceCategory[] = new Array(prices.length);
  for (const indexes of days.values()) {
    const sorted = indexes.map((i) => prices[i].price).sort((a, b) => a - b);
    for (const i of indexes) {
      const price = prices[i].price;
      // Middle of the run of equal prices, as a share of the day
      const below = sorted.findIndex((value) => value >= price);
      const equal = sorted.filter((value) => value === price).length;
      const share = (below + equal / 2) / sorted.length;
      categories[i] = QUINTILES[Math.min(4, Math.floor(share * 5))];
    }
  }
  return categories;
}
