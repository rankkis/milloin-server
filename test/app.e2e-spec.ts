import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ElectricityPriceService } from '../src/shared/electricity-price/electricity-price.service';
import { ElectricityPriceDto } from '../src/shared/electricity-price/dto/electricity-price.dto';
import { PriceCacheService } from '../src/shared/electricity-price/services/price-cache.service';
import { startOfHelsinkiDay } from '../src/shared/utils/helsinki-time.helper';

const QUARTER_MS = 15 * 60 * 1000;

/**
 * 15-minute prices from 24 hours ago to 36 hours ahead, with a cheap
 * dip so every endpoint has an obvious optimal window.
 */
const createPrices = (): ElectricityPriceDto[] => {
  const firstQuarter =
    Math.floor(Date.now() / QUARTER_MS) * QUARTER_MS - 24 * 4 * QUARTER_MS;
  return Array.from({ length: 60 * 4 }, (_, q) => {
    const start = firstQuarter + q * QUARTER_MS;
    const hour = Math.floor(q / 4) % 24;
    return {
      price: hour >= 2 && hour < 6 ? 0.02 : 0.08,
      startDate: new Date(start).toISOString(),
      endDate: new Date(start + QUARTER_MS).toISOString(),
    };
  });
};

describe('API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const prices = createPrices();
    const now = () => Date.now();
    const future = () => prices.filter((p) => Date.parse(p.endDate) > now());
    // Prices of one Finnish day, as the price cache slices them
    const finnishDay = (daysFromToday: number) => {
      const start = startOfHelsinkiDay(new Date(), daysFromToday).getTime();
      const end = startOfHelsinkiDay(new Date(), daysFromToday + 1).getTime();
      return prices.filter((p) => {
        const priceStart = Date.parse(p.startDate);
        return priceStart >= start && priceStart < end;
      });
    };

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ElectricityPriceService)
      .useValue({
        getCurrentPrices: async () => future().slice(0, 1),
        getTodayPrices: async () => finnishDay(0),
        getTomorrowPrices: async () => finnishDay(1),
        getFuturePrices: async () => future(),
      })
      // No upstream price fetches or scheduled jobs in tests
      .overrideProvider(PriceCacheService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const expectOptimalTime = (value: any) => {
    expect(new Date(value.startTime).toISOString()).toBe(value.startTime);
    expect(new Date(value.endTime).toISOString()).toBe(value.endTime);
    expect(typeof value.priceAvg).toBe('number');
    expect(typeof value.priceCategory).toBe('string');
    expect(Array.isArray(value.pricePoints)).toBe(true);
  };

  it('GET /overview returns the current price and summaries', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/overview')
      .expect(200);

    expect(body.current.price).toBe(8);
    expect(body.current.priceCategory).toBe('NORMAL');
    expect(body.next12Hours.pricePoints.length).toBeGreaterThan(0);
    expect(body.future.pricePoints.length).toBeGreaterThan(0);
    expect(body.today.length).toBeGreaterThanOrEqual(23);
    expect(body.today[0].startTime).toBe(
      startOfHelsinkiDay(new Date()).toISOString(),
    );
    expect(body.upcomingHours[0].startTime).toBe(
      new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString(),
    );
    expect(body.cheapestWindow.pricePoints).toHaveLength(8);
    expect(body.cheapestWindow.priceAvg).toBe(2);
  });

  it('GET /wash-laundry/optimal-schedule returns a 2-hour schedule', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/wash-laundry/optimal-schedule')
      .expect(200);

    expectOptimalTime(body.now);
    expect(body.now.pricePoints).toHaveLength(8);
    expect(body.defaults.periodHours).toBe(2);
    expect(body.defaults.powerConsumptionKwh).toBe(1.5);
    expect(body.startDelays).toHaveLength(6);
    expect(body.startDelays.filter((d) => d.isBest)).toHaveLength(1);
    expect(body.today || body.tonight || body.tomorrow).toBeDefined();
  });

  it('GET /charge-ev/optimal-schedule returns a 4-hour schedule', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/charge-ev/optimal-schedule')
      .expect(200);

    expectOptimalTime(body.now);
    expectOptimalTime(body.next12Hours);
    expect(body.next12Hours.pricePoints).toHaveLength(16);
    expect(body.next12Hours.priceAvg).toBeLessThanOrEqual(body.now.priceAvg);
    expect(body.defaults).toMatchObject({
      periodHours: 4,
      powerConsumptionKwh: 11,
    });
  });
});
