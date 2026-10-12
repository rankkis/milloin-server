import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { hourlyPrices } from '../../pricing/hours';
import { priceCategory } from '../../pricing/price-category';
import { PricePoint, round2 } from '../../pricing/price-point';
import { dayCategories } from '../../pricing/day-category';
import { VAT_PERCENT, withoutVat } from '../../pricing/vat';
import { PriceOptionsDto } from '../common/price-options.dto';
import { Clock } from '../../shared/clock/clock';
import { ElectricityPriceService } from '../../shared/electricity-price/electricity-price.service';
import { startOfHelsinkiDay } from '../../shared/utils/helsinki-time.helper';
import { PricesQueryDto, Resolution } from './dto/prices-query.dto';
import {
  PriceDto,
  PriceNowDto,
  PricesDto,
  PricesMetaDto,
} from './dto/prices.dto';

interface TimedPrice {
  startTime: string;
  endTime: string;
  price: number;
}

/** Prices come with VAT; categories are judged on that price either way */
const toPriceDtos = (prices: TimedPrice[], vat: boolean): PriceDto[] => {
  const dayCategory = dayCategories(prices);
  return prices.map((price, i) => ({
    startTime: price.startTime,
    endTime: price.endTime,
    price: round2(vat ? price.price : withoutVat(price.price)),
    category: priceCategory(price.price),
    dayCategory: dayCategory[i],
  }));
};

const covers = (price: TimedPrice, time: number): boolean =>
  Date.parse(price.startTime) <= time && Date.parse(price.endTime) > time;

@Injectable()
export class PricesService {
  constructor(
    private readonly electricityPriceService: ElectricityPriceService,
    private readonly clock: Clock,
  ) {}

  async getPrices(query: PricesQueryDto): Promise<PricesDto> {
    const now = this.clock.now();
    const from = query.from
      ? Date.parse(query.from)
      : startOfHelsinkiDay(new Date(now)).getTime();
    const to = query.to ? Date.parse(query.to) : Infinity;
    if (to <= from) {
      throw new BadRequestException('to must be after from');
    }

    const resolution = query.resolution ?? '15min';
    const vat = query.vat ?? true;
    const quarters = await this.electricityPriceService.getPrices();
    const prices = toPriceDtos(this.atResolution(quarters, resolution), vat);
    return {
      current: this.current(prices, now),
      prices: prices.filter(
        (price) =>
          Date.parse(price.endTime) > from && Date.parse(price.startTime) < to,
      ),
      meta: this.meta(quarters, resolution, vat),
    };
  }

  async getCurrentPrice(options: PriceOptionsDto): Promise<PriceNowDto> {
    const now = this.clock.now();
    const vat = options.vat ?? true;
    const quarters = await this.electricityPriceService.getPrices();
    return {
      ...this.current(toPriceDtos(quarters, vat), now),
      meta: this.meta(quarters, '15min', vat),
    };
  }

  private atResolution(
    quarters: PricePoint[],
    resolution: Resolution,
  ): TimedPrice[] {
    return resolution === 'hour'
      ? hourlyPrices(quarters).map((hour) => ({
          startTime: hour.startTime,
          endTime: hour.endTime,
          price: hour.priceAvg,
        }))
      : quarters;
  }

  private current(prices: PriceDto[], now: number): PriceDto {
    const current = prices.find((price) => covers(price, now));
    if (!current) {
      throw new HttpException(
        'The current electricity price is not available',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return current;
  }

  private meta(
    quarters: PricePoint[],
    resolution: Resolution,
    vat: boolean,
  ): PricesMetaDto {
    return {
      unit: 'c/kWh',
      vatIncluded: vat,
      vatPercent: vat ? VAT_PERCENT : 0,
      area: 'FI',
      resolution,
      ...this.electricityPriceService.getFreshness(quarters),
    };
  }
}
