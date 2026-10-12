import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { hourlyPrices } from '../../pricing/hours';
import { priceCategory } from '../../pricing/price-category';
import { PricePoint, round2 } from '../../pricing/price-point';
import { VAT_PERCENT } from '../../pricing/vat';
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

const toPriceDto = (price: TimedPrice): PriceDto => ({
  startTime: price.startTime,
  endTime: price.endTime,
  price: round2(price.price),
  category: priceCategory(price.price),
});

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
    const quarters = await this.electricityPriceService.getPrices();
    const prices = this.atResolution(quarters, resolution);
    return {
      current: toPriceDto(this.current(prices, now)),
      prices: prices
        .filter(
          (price) =>
            Date.parse(price.endTime) > from &&
            Date.parse(price.startTime) < to,
        )
        .map(toPriceDto),
      meta: this.meta(quarters, resolution, now),
    };
  }

  async getCurrentPrice(): Promise<PriceNowDto> {
    const now = this.clock.now();
    const quarters = await this.electricityPriceService.getPrices();
    return {
      ...toPriceDto(this.current(quarters, now)),
      meta: this.meta(quarters, '15min', now),
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

  private current(prices: TimedPrice[], now: number): TimedPrice {
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
    now: number,
  ): PricesMetaDto {
    const pricesUntil = Date.parse(quarters[quarters.length - 1].endTime);
    const tomorrowStart = startOfHelsinkiDay(new Date(now), 1).getTime();
    return {
      unit: 'c/kWh',
      vatIncluded: true,
      vatPercent: VAT_PERCENT,
      area: 'FI',
      resolution,
      pricesUntil: new Date(pricesUntil).toISOString(),
      // A day's prices are published all at once
      tomorrowPublished: pricesUntil > tomorrowStart,
    };
  }
}
