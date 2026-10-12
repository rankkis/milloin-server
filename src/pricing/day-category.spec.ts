import { PriceCategory } from './price-category';
import { dayCategories } from './day-category';

const hour = (h: number, price: number) => ({
  // Finnish winter time: 00:00 is 22:00Z the day before
  startTime: new Date(
    Date.parse('2026-11-30T22:00:00Z') + h * 3600000,
  ).toISOString(),
  price,
});

describe('dayCategories', () => {
  it('ranks each price among its own day', () => {
    const prices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((price, h) =>
      hour(h, price),
    );

    expect(dayCategories(prices)).toEqual([
      PriceCategory.VERY_CHEAP,
      PriceCategory.VERY_CHEAP,
      PriceCategory.CHEAP,
      PriceCategory.CHEAP,
      PriceCategory.NORMAL,
      PriceCategory.NORMAL,
      PriceCategory.EXPENSIVE,
      PriceCategory.EXPENSIVE,
      PriceCategory.VERY_EXPENSIVE,
      PriceCategory.VERY_EXPENSIVE,
    ]);
  });

  it('keeps days apart and equal prices together', () => {
    const categories = dayCategories([
      hour(0, 5),
      hour(1, 5),
      hour(24, 1),
      hour(25, 9),
    ]);

    expect(categories[0]).toBe(categories[1]);
    expect(categories[2]).toBe(PriceCategory.CHEAP);
    expect(categories[3]).toBe(PriceCategory.EXPENSIVE);
  });
});
