import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ElectricityPriceService } from '../src/shared/electricity-price/electricity-price.service';
import { ElectricityPriceDto } from '../src/shared/electricity-price/dto/electricity-price.dto';
import { PriceCacheService } from '../src/shared/electricity-price/services/price-cache.service';
import { startOfHelsinkiDay } from '../src/shared/utils/helsinki-time.helper';
import {
  CONTACT_EMAIL,
  PUBLIC_API_URL,
  createOpenApiDocument,
  enablePublicCors,
  setupSwaggerUi,
} from '../src/app.setup';
import {
  RATE_LIMIT,
  SSR_KEY_HEADER,
} from '../src/shared/config/rate-limit.config';

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
    process.env.SSR_API_KEY = 'test-ssr-key';
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
    enablePublicCors(app);
    setupSwaggerUi(app, createOpenApiDocument(app));
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

  it('GET /optimal-window/presets lists the presets', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/optimal-window/presets')
      .expect(200);

    expect(body.map((preset) => preset.name)).toEqual([
      'wash-laundry',
      'charge-ev',
      'sauna',
    ]);
  });

  it('GET /optimal-window/presets/charge-ev returns the 3 cheapest 4-hour windows', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/optimal-window/presets/charge-ev')
      .expect(200);

    expect(body).toMatchObject({ durationHours: 4, energyKwh: 11 });
    expect(body.windows).toHaveLength(3);
    body.windows.forEach((window) => {
      expectOptimalTime(window);
      expect(window.pricePoints).toHaveLength(16);
    });
    const averages = body.windows.map((window) => window.priceAvg);
    expect(averages).toEqual([...averages].sort((a, b) => a - b));
    expect(body.windows[0].savingsCents).toBeGreaterThanOrEqual(0);
  });

  it('GET /optimal-window/presets/wash-laundry compares starting now and in 1 to 5 hours', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/optimal-window/presets/wash-laundry')
      .expect(200);

    expect(body).toMatchObject({ durationHours: 2, energyKwh: 1.5 });
    expect(body.startOffsets.map((window) => window.offsetHours)).toEqual([
      0, 1, 2, 3, 4, 5,
    ]);
    expect(body.startOffsets[0].startTime).toBe(body.startNow.startTime);
    body.startOffsets.forEach((window) => {
      expect(window.pricePoints).toHaveLength(8);
      expect(window.costCents).toBeCloseTo(window.priceAvg * 1.5);
    });
  });

  it('GET /optimal-window/presets/sauna compares 3-hour sessions starting at every full hour', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/optimal-window/presets/sauna')
      .expect(200);

    expect(body).toMatchObject({ durationHours: 3, energyKwh: 8 });
    // Prices reach 36 hours ahead, so about 32 full-hour starts fit
    expect(body.startOffsets.length).toBeGreaterThan(30);
    body.startOffsets.forEach((window) => {
      expect(new Date(window.startTime).getUTCMinutes()).toBe(0);
      expect(window.pricePoints).toHaveLength(12);
      expect(window.costCents).toBeCloseTo(window.priceAvg * 8);
    });
    const lastEnd = Date.parse(
      body.startOffsets[body.startOffsets.length - 1].endTime,
    );
    expect(lastEnd).toBeLessThanOrEqual(Date.parse(body.latestEnd));
  });

  it('GET /optimal-window/presets/unknown answers 404', async () => {
    await request(app.getHttpServer())
      .get('/optimal-window/presets/unknown')
      .expect(404);
  });

  it('POST /optimal-window finds windows for custom parameters', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/optimal-window')
      .send({ durationHours: 1.5, energyKwh: 3, count: 2 })
      .expect(200);

    expect(body.windows).toHaveLength(2);
    expect(body.windows[0].pricePoints).toHaveLength(6);
    expect(body.windows[0].costCents).toBeCloseTo(body.windows[0].priceAvg * 3);
  });

  it('POST /optimal-window rejects invalid parameters', async () => {
    await request(app.getHttpServer())
      .post('/optimal-window')
      .send({ durationHours: 30 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/optimal-window')
      .send({ durationHours: 2, unknown: true })
      .expect(400);
    await request(app.getHttpServer())
      .post('/optimal-window')
      .send({ durationHours: 2, startOffsetsHours: [0, 30] })
      .expect(400);
  });

  it('POST /optimal-schedule plans the energy in the cheap hours before the deadline', async () => {
    const deadlineAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { body } = await request(app.getHttpServer())
      .post('/optimal-schedule')
      .send({
        energyKwh: 30,
        maxPowerKw: 11,
        options: { deadlineAt, minConsecutiveHours: 1 },
      })
      .expect(200);

    expect(body).toMatchObject({ energyKwh: 30, maxPowerKw: 11, deadlineAt });
    const slots = body.blocks.flatMap((block) => block.slots);
    // 30 kWh at 2.75 kWh a slot: 10 full slots and 2.5 kWh
    expect(slots).toHaveLength(11);
    slots.forEach((slot) => {
      expect(slot.price).toBe(2);
      expect(Date.parse(slot.endTime)).toBeLessThanOrEqual(
        Date.parse(deadlineAt),
      );
    });
    expect(body.costCents).toBeCloseTo(60);
    expect(body.savingsCents).toBeGreaterThanOrEqual(0);
  });

  it('POST /optimal-schedule rejects invalid parameters', async () => {
    await request(app.getHttpServer())
      .post('/optimal-schedule')
      .send({ energyKwh: 50 })
      .expect(400);
    await request(app.getHttpServer())
      .post('/optimal-schedule')
      .send({ energyKwh: 50, maxPowerKw: 11, options: { unknown: true } })
      .expect(400);
    await request(app.getHttpServer())
      .post('/optimal-schedule')
      .send({
        energyKwh: 50,
        maxPowerKw: 11,
        options: { minConsecutiveHours: 13 },
      })
      .expect(400);
    await request(app.getHttpServer())
      .post('/optimal-schedule')
      .send({ energyKwh: 1000, maxPowerKw: 1 })
      .expect(400);
  });

  it('allows browser requests from any origin', async () => {
    await request(app.getHttpServer())
      .get('/overview')
      .set('Origin', 'https://example.com')
      .expect(200)
      .expect('Access-Control-Allow-Origin', '*');
  });

  it('lets browsers POST JSON from any origin', async () => {
    const { headers } = await request(app.getHttpServer())
      .options('/optimal-window')
      .set('Origin', 'https://example.com')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type')
      .expect(204);

    expect(headers['access-control-allow-methods']).toContain('POST');
    expect(headers['access-control-allow-headers']).toContain('content-type');
  });

  it('GET /api-json describes the public API with a contact', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api-json')
      .expect(200);

    expect(body.info.contact.email).toBe(CONTACT_EMAIL);
    expect(body.servers[0].url).toBe(PUBLIC_API_URL);
    expect(Object.keys(body.paths)).toEqual(
      expect.arrayContaining([
        '/overview',
        '/optimal-window',
        '/optimal-window/presets',
        '/optimal-window/presets/{preset}',
        '/optimal-schedule',
      ]),
    );
  });

  it('GET /api serves Swagger UI', async () => {
    const { text } = await request(app.getHttpServer()).get('/api').expect(200);

    expect(text).toContain('<title>Milloin API</title>');
    await request(app.getHttpServer())
      .get('/api/swagger-ui-init.js')
      .expect(200);
  });

  // Last: it uses up this client's requests for the minute
  it('answers 429 once a client goes over the rate limit', async () => {
    const client = '203.0.113.7';
    for (let i = 0; i < RATE_LIMIT.LIMIT; i++) {
      await request(app.getHttpServer())
        .get('/overview')
        .set('X-Forwarded-For', client)
        .expect(200);
    }
    await request(app.getHttpServer())
      .get('/overview')
      .set('X-Forwarded-For', client)
      .expect(429);
    // Another client still gets through
    await request(app.getHttpServer())
      .get('/overview')
      .set('X-Forwarded-For', '203.0.113.8')
      .expect(200);
    // milloin-web's server-side rendering is not limited
    await request(app.getHttpServer())
      .get('/overview')
      .set('X-Forwarded-For', client)
      .set(SSR_KEY_HEADER, 'test-ssr-key')
      .expect(200);
    await request(app.getHttpServer())
      .get('/overview')
      .set('X-Forwarded-For', client)
      .set(SSR_KEY_HEADER, 'wrong-key')
      .expect(429);
  });
});
