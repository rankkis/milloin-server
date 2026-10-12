import { Injectable, Optional } from '@nestjs/common';
import { hourlyPrices } from '../pricing/hours';
import { priceCategory } from '../pricing/price-category';
import { HOUR_MS, PricePoint, round2 } from '../pricing/price-point';
import { cheapestWindows } from '../pricing/windows';
import { Clock, systemClock } from '../shared/clock/clock';
import {
  toOptimalTimeDto,
  toPricePointDto,
} from '../shared/dto/optimal-time.mapper';
import { ElectricityPriceService } from '../shared/electricity-price/electricity-price.service';
import {
  FuturePriceSummaryDto,
  HourlyPriceDto,
  OverviewDto,
} from './dto/overview.dto';

/** Length of the cheapest window shown on the home screen */
const CHEAPEST_WINDOW_HOURS = 2;

@Injectable()
export class OverviewService {
  constructor(
    private readonly electricityPriceService: ElectricityPriceService,
    @Optional() private readonly clock: Clock = systemClock,
  ) {}

  async getOverview(): Promise<OverviewDto> {
    const [current, allPrices, todayPrices, upcoming] = await Promise.all([
      this.electricityPriceService.getCurrentPrice(),
      this.electricityPriceService.getPrices(),
      this.electricityPriceService.getDayPrices(0),
      this.electricityPriceService.getUpcomingPrices(),
    ]);
    const now = this.clock.now();
    const currentHourStart = Math.floor(now / HOUR_MS) * HOUR_MS;
    const next12Hours = upcoming.filter(
      (price) => Date.parse(price.startTime) < now + 12 * HOUR_MS,
    );
    const [cheapestWindow] = cheapestWindows(
      upcoming,
      CHEAPEST_WINDOW_HOURS * 4,
      1,
    );

    return {
      current: {
        price: round2(current.price),
        priceCategory: priceCategory(current.price),
      },
      // Both start at the current quarter, so neither is ever empty
      next12Hours: this.summary(next12Hours),
      future: this.summary(upcoming),
      today: hourlyPrices(todayPrices).map(this.toHourlyPrice),
      upcomingHours: hourlyPrices(
        allPrices.filter(
          (price) => Date.parse(price.startTime) >= currentHourStart,
        ),
      ).map(this.toHourlyPrice),
      ...(cheapestWindow && {
        cheapestWindow: toOptimalTimeDto(cheapestWindow),
      }),
    };
  }

  private toHourlyPrice = (hour: {
    startTime: string;
    endTime: string;
    priceAvg: number;
  }): HourlyPriceDto => ({
    startTime: hour.startTime,
    endTime: hour.endTime,
    priceAvg: round2(hour.priceAvg),
    priceCategory: priceCategory(hour.priceAvg),
  });

  private summary(prices: PricePoint[]): FuturePriceSummaryDto {
    const priceAvg =
      prices.reduce((sum, price) => sum + price.price, 0) / prices.length;
    return {
      priceAvg: round2(priceAvg),
      priceCategory: priceCategory(priceAvg),
      pricePoints: prices.map(toPricePointDto),
    };
  }
}
