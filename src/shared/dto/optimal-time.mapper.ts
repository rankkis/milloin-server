import { priceCategory } from '../../pricing/price-category';
import { PricePoint, round2 } from '../../pricing/price-point';
import { PriceWindow } from '../../pricing/windows';
import { OptimalTimeDto, PricePointDto } from './optimal-time.dto';

/** A price rounded for output */
export const toPricePointDto = (price: PricePoint): PricePointDto => ({
  startTime: price.startTime,
  endTime: price.endTime,
  price: round2(price.price),
});

/** A window rounded for output */
export const toOptimalTimeDto = (window: PriceWindow): OptimalTimeDto => ({
  startTime: window.startTime,
  endTime: window.endTime,
  priceAvg: round2(window.priceAvg),
  priceCategory: priceCategory(window.priceAvg),
  pricePoints: window.prices.map(toPricePointDto),
});
