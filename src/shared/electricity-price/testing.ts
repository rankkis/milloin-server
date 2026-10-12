import { ElectricityPriceDto } from './dto/electricity-price.dto';
import { ElectricityPriceService } from './electricity-price.service';
import { PriceCacheService } from './services/price-cache.service';

/**
 * An ElectricityPriceService over a fixed list of prices in €/kWh, as the
 * price cache would hold them. For tests.
 */
export const priceServiceFor = (
  prices: ElectricityPriceDto[] | (() => ElectricityPriceDto[]),
): ElectricityPriceService =>
  new ElectricityPriceService({
    getPrices: async () => (typeof prices === 'function' ? prices() : prices),
  } as unknown as PriceCacheService);
