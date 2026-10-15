import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ElectricityPriceDto } from '../src/shared/electricity-price/dto/electricity-price.dto';
import { PriceCacheService } from '../src/shared/electricity-price/services/price-cache.service';
import { startOfHelsinkiDay } from '../src/shared/utils/helsinki-time.helper';
import { EnceCacheService } from '../src/ence/ence-cache.service';
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

    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Prices from memory, no upstream fetches or scheduled jobs in tests
      .overrideProvider(PriceCacheService)
      .useValue({
        getPrices: async () => prices,
        getSource: () => ({
          source: 'ENTSO-E',
          fetchedAt: new Date().toISOString(),
        }),
      })
      .overrideProvider(EnceCacheService)
      .useValue({
        getSnapshot: async () => ({
          fetchedAt: new Date().toISOString(),
          source: 'PandaScore',
          data: {
            team: { name: 'ENCE', logoUrl: 'https://cdn/ence.png' },
            matches: [
              {
                id: '1',
                startTime: new Date(Date.now() + 86400000).toISOString(),
                live: false,
                opponent: { name: 'Sashi' },
                event: 'CCT Europe Series 9',
                format: 'Bo3',
                streams: ['ru', 'en', 'fi'].map((language) => ({
                  name: `cct_${language}`,
                  platform: 'Twitch',
                  language,
                  url: `https://www.twitch.tv/cct_${language}`,
                  official: true,
                })),
              },
            ],
            results: [],
          },
          news: [],
          logos: { 'https://cdn/ence.png': '0123456789abcdef' },
        }),
        getLogo: async (id: string) =>
          id === '0123456789abcdef'
            ? {
                contentType: 'image/png',
                data: Buffer.from('png').toString('base64'),
              }
            : undefined,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    enablePublicCors(app);
    setupSwaggerUi(app, createOpenApiDocument(app));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('lets the CDN cache GET responses until the next quarter hour', async () => {
    const { headers } = await request(app.getHttpServer())
      .get('/v1/electricity/prices/current')
      .expect(200);

    const sMaxAge = Number(/s-maxage=(\d+)/.exec(headers['cache-control'])[1]);
    expect(headers['cache-control']).toMatch(/^public, max-age=\d+, /);
    expect(sMaxAge).toBeGreaterThan(0);
    expect(sMaxAge).toBeLessThanOrEqual(15 * 60);
  });

  it('does not let errors or POST responses be cached', async () => {
    const notFound = await request(app.getHttpServer())
      .get('/v1/electricity/plans/presets/unknown')
      .expect(404);
    expect(notFound.headers['cache-control']).toBe('no-store');

    const posted = await request(app.getHttpServer())
      .post('/v1/electricity/plans/search')
      .send({ durationHours: 1 })
      .expect(200);
    expect(posted.headers['cache-control']).toBeUndefined();
  });

  it('GET /v1/prices returns today and tomorrow with the price now', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/v1/electricity/prices')
      .expect(200);

    const midnight = startOfHelsinkiDay(new Date()).toISOString();
    expect(body.current).toMatchObject({ price: 8, category: 'NORMAL' });
    expect(body.prices[0].startTime).toBe(midnight);
    expect(body.prices[0]).toEqual({
      startTime: midnight,
      endTime: new Date(Date.parse(midnight) + QUARTER_MS).toISOString(),
      price: expect.any(Number),
      category: expect.any(String),
      dayCategory: expect.any(String),
    });
    expect(body.meta).toEqual({
      unit: 'c/kWh',
      vatIncluded: true,
      vatPercent: 25.5,
      area: 'FI',
      resolution: '15min',
      pricesUntil: body.prices[body.prices.length - 1].endTime,
      tomorrowPublished: true,
      nextPricesExpectedAt: expect.any(String),
      source: 'ENTSO-E',
      fetchedAt: expect.any(String),
    });
  });

  it('GET /v1/prices averages clock hours and takes times with an offset', async () => {
    const from = new Date(Math.floor(Date.now() / 3600000) * 3600000);
    // 3 hours from the start of this hour, as Finnish summer time with a
    // plain + that a URL turns into a space
    const to = new Date(from.getTime() + 3 * 3600000 + 3 * 3600000)
      .toISOString()
      .replace('.000Z', '+03:00');
    const { body } = await request(app.getHttpServer())
      .get(
        `/v1/electricity/prices?resolution=hour&from=${from.toISOString()}&to=${to}`,
      )
      .expect(200);

    expect(body.meta.resolution).toBe('hour');
    expect(body.prices).toHaveLength(3);
    expect(body.prices[0].startTime).toBe(from.toISOString());
    expect(body.current.startTime).toBe(from.toISOString());
  });

  it('GET /v1/prices leaves VAT out with vat=false', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/v1/electricity/prices/current?vat=false&area=FI')
      .expect(200);

    expect(body.price).toBe(6.37); // 8 / 1.255
    expect(body.category).toBe('NORMAL');
    expect(body.meta).toMatchObject({ vatIncluded: false, vatPercent: 0 });
    await request(app.getHttpServer())
      .get('/v1/electricity/prices/current?area=SE3')
      .expect(400);
  });

  it('GET /v1/prices answers invalid parameters with problem details', async () => {
    const { body, headers } = await request(app.getHttpServer())
      .get('/v1/electricity/prices?resolution=day&extra=1')
      .expect(400);

    expect(headers['content-type']).toMatch(/^application\/problem\+json/);
    expect(body).toMatchObject({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
    });
    expect(body.errors.map((error) => error.field).sort()).toEqual([
      'extra',
      'resolution',
    ]);
  });

  it('GET /v1/prices/current returns the price now', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/v1/electricity/prices/current')
      .expect(200);

    expect(body).toMatchObject({ price: 8, category: 'NORMAL' });
    expect(body.meta.unit).toBe('c/kWh');
  });

  it('GET /v1/plans ranks continuous runs with costs and savings', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/v1/electricity/plans?durationHours=2&energyKwh=1.5')
      .expect(200);

    expect(body.request).toMatchObject({
      pausable: false,
      durationHours: 2,
      energyKwh: 1.5,
      limit: 3,
    });
    expect(body.meta).toMatchObject({ priceUnit: 'c/kWh', currency: 'EUR' });
    expect(body.plans).toHaveLength(3);
    // The cheap hours cost 2 c/kWh
    expect(body.plans[0]).toMatchObject({ priceAvg: 2, costCents: 3 });
    expect(body.plans[0].blocks).toHaveLength(1);
    expect(body.plans[0].savingsCents).toBeCloseTo(
      body.startNow.costCents - body.plans[0].costCents,
    );
    expect(body.activeNow).toBe(body.plans[0].activeNow);
  });

  it('GET /v1/plans plans a pausable load before a deadline', async () => {
    const latestEnd = new Date(Date.now() + 30 * 3600000).toISOString();
    const { body } = await request(app.getHttpServer())
      .get(
        `/v1/electricity/plans?pausable=true&energyKwh=22&maxPowerKw=11&minBlockHours=1&latestEnd=${latestEnd}`,
      )
      .expect(200);

    expect(body.request).toMatchObject({
      pausable: true,
      durationHours: 2,
      minBlockHours: 1,
      limit: 1,
    });
    expect(body.plans).toHaveLength(1);
    const [plan] = body.plans;
    expect(plan.priceAvg).toBe(2);
    expect(plan.costCents).toBe(44);
    plan.blocks.forEach((block) => {
      expect(Date.parse(block.endTime)).toBeLessThanOrEqual(
        Date.parse(latestEnd),
      );
      expect(
        Date.parse(block.endTime) - Date.parse(block.startTime),
      ).toBeGreaterThanOrEqual(3600000);
    });
    expect(typeof plan.activeNow).toBe('boolean');
  });

  it('GET /v1/plans gives the same plan all day from a fixed start', async () => {
    const { body } = await request(app.getHttpServer())
      .get(
        '/v1/electricity/plans?pausable=true&durationHours=4&earliestStart=today&latestEnd=tomorrow',
      )
      .expect(200);

    expect(body.request.earliestStart).toBe(
      startOfHelsinkiDay(new Date()).toISOString(),
    );
    expect(body.request.latestEnd).toBe(
      startOfHelsinkiDay(new Date(), 1).toISOString(),
    );
    expect(body.plans[0].priceAvg).toBe(2);
  });

  it('GET /v1/plans plans on hourly prices with resolution=hour', async () => {
    const { body } = await request(app.getHttpServer())
      .get(
        '/v1/electricity/plans?pausable=true&energyKwh=25&maxPowerKw=11&resolution=hour&vat=false',
      )
      .expect(200);

    expect(body.request).toMatchObject({
      resolution: 'hour',
      durationHours: 3,
      minBlockHours: 1,
    });
    expect(body.meta.vatIncluded).toBe(false);
    body.plans[0].blocks.forEach((block) => {
      expect(new Date(block.startTime).getUTCMinutes()).toBe(0);
    });
    // 2 c/kWh with VAT
    expect(body.plans[0].priceAvg).toBe(1.59);
    await request(app.getHttpServer())
      .get('/v1/electricity/plans?durationHours=1.5&resolution=hour')
      .expect(400);
  });

  it('GET /v1/plans refuses parameters that do not fit together', async () => {
    const missing = await request(app.getHttpServer())
      .get('/v1/electricity/plans?energyKwh=10')
      .expect(400);
    expect(missing.body.detail).toBe(
      'Give durationHours, or energyKwh with maxPowerKw',
    );
    await request(app.getHttpServer())
      .get('/v1/electricity/plans?durationHours=1.1')
      .expect(400);
    await request(app.getHttpServer())
      .get('/v1/electricity/plans?durationHours=1&minBlockHours=1')
      .expect(400);
    await request(app.getHttpServer())
      .get('/v1/electricity/plans?durationHours=1&pausable=maybe')
      .expect(400);
  });

  it('GET /v1/plans/presets lists the presets', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/v1/electricity/plans/presets')
      .expect(200);

    expect(body.map((preset) => preset.name)).toEqual([
      'laundry',
      'sauna',
      'ev-charging',
    ]);
  });

  it('GET /v1/plans/presets/ev-charging takes overrides', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/v1/electricity/plans/presets/ev-charging?energyKwh=11')
      .expect(200);

    expect(body.request).toMatchObject({
      preset: 'ev-charging',
      pausable: true,
      energyKwh: 11,
      maxPowerKw: 11,
      durationHours: 1,
    });

    const byDuration = await request(app.getHttpServer())
      .get('/v1/electricity/plans/presets/ev-charging?durationHours=3')
      .expect(200);
    expect(byDuration.body.request).toMatchObject({
      durationHours: 3,
      energyKwh: 44,
    });
    await request(app.getHttpServer())
      .get('/v1/electricity/plans/presets/unknown')
      .expect(404);
  });

  it('POST /v1/plans/search compares given start times with a power profile', async () => {
    const now = Math.floor(Date.now() / QUARTER_MS) * QUARTER_MS;
    const startTimes = [0, 1, 2].map((hours) =>
      new Date(now + hours * 3600000).toISOString(),
    );
    const { body } = await request(app.getHttpServer())
      .post('/v1/electricity/plans/search')
      .send({ profileKwh: [2, 2, 1, 1], startTimes })
      .expect(200);

    expect(body.request.durationHours).toBe(1);
    expect(body.request.energyKwh).toBe(6);
    expect(body.startTimes.map((run) => run.requestedStart)).toEqual(
      startTimes,
    );
    body.startTimes.forEach((run) => {
      expect(run.costCents).toBeCloseTo(run.priceAvg * 6, 1);
    });
  });

  it('GET /v1/health tells whether the prices are fresh', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/v1/electricity/health')
      .expect(200);

    expect(body).toMatchObject({
      status: 'ok',
      tomorrowPublished: true,
      source: 'ENTSO-E',
    });
    // Tomorrow's are in, so the next are expected tomorrow
    expect(Date.parse(body.nextPricesExpectedAt)).toBeGreaterThan(Date.now());
  });

  it('GET /v1/misc/ence returns the next match with Finnish and English streams', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/v1/misc/ence')
      .expect(200);

    expect(body.team).toEqual({
      name: 'ENCE',
      logo: 'v1/misc/ence/logos/0123456789abcdef',
    });
    expect(body.nextMatch.opponent.name).toBe('Sashi');
    expect(body.nextMatch.streams.map((s: any) => s.language)).toEqual([
      'fi',
      'en',
    ]);
  });

  it('GET /v1/misc/ence/logos/:id serves a copied logo', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/misc/ence/logos/0123456789abcdef')
      .expect(200);

    expect(response.headers['content-type']).toBe('image/png');
    expect(response.headers['cache-control']).toBe('public, max-age=604800');
    await request(app.getHttpServer())
      .get('/v1/misc/ence/logos/ffffffffffffffff')
      .expect(404);
  });

  it("GET /v1/electricity/forecasts/72h serves the forecaster's forecast", async () => {
    process.env.FORECASTER_API_URL = 'https://forecaster.test';
    process.env.FORECASTER_API_KEY = 'test-forecaster-key';
    const forecast = {
      horizon: '72h',
      resolution: 'hour',
      issuedAt: '2026-10-15T09:00:00.000Z',
      modelVersion: '72h-hour-profile-v1',
      change: '0001',
      points: [],
    };
    const fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify(forecast)));

    try {
      const response = await request(app.getHttpServer())
        .get('/v1/electricity/forecasts/72h')
        .expect(200);
      expect(response.body).toEqual(forecast);
      expect(response.headers['cache-control']).toContain('s-maxage=600');
      expect(fetchSpy.mock.calls[0][0]).toBe(
        'https://forecaster.test/v1/forecasts/72h',
      );

      await request(app.getHttpServer())
        .get('/v1/electricity/forecasts/year')
        .expect(400);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('allows browser requests from any origin', async () => {
    await request(app.getHttpServer())
      .get('/v1/electricity/prices/current')
      .set('Origin', 'https://example.com')
      .expect(200)
      .expect('Access-Control-Allow-Origin', '*');
  });

  it('lets browsers POST JSON from any origin', async () => {
    const { headers } = await request(app.getHttpServer())
      .options('/v1/electricity/plans/search')
      .set('Origin', 'https://example.com')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type')
      .expect(204);

    expect(headers['access-control-allow-methods']).toContain('POST');
    expect(headers['access-control-allow-headers']).toContain('content-type');
  });

  it('no longer answers the paths before the categories', async () => {
    for (const path of ['/v1/prices', '/v1/plans', '/v1/health', '/ence']) {
      await request(app.getHttpServer()).get(path).expect(404);
    }
  });

  it('GET /api-json describes the public API with a contact', async () => {
    const { body } = await request(app.getHttpServer())
      .get('/api-json')
      .expect(200);

    expect(body.info.contact.email).toBe(CONTACT_EMAIL);
    expect(body.servers[0].url).toBe(PUBLIC_API_URL);
    expect(Object.keys(body.paths)).toEqual(
      expect.arrayContaining([
        '/v1/electricity/prices',
        '/v1/electricity/prices/current',
        '/v1/electricity/plans',
        '/v1/electricity/plans/search',
        '/v1/electricity/plans/presets',
        '/v1/electricity/plans/presets/{name}',
        '/v1/electricity/health',
        '/v1/misc/ence',
      ]),
    );
    expect(body.paths['/v1/electricity/prices'].get.operationId).toBe(
      'getPrices',
    );
    expect(
      Object.keys(body.paths).filter((path) => !path.startsWith('/v1')),
    ).toEqual([]);
    expect(body.paths['/v1/misc/ence'].get.operationId).toBe('getEnce');
    // milloin-web's forecasts are not part of the public API
    expect(
      Object.keys(body.paths).filter((path) => path.includes('forecast')),
    ).toEqual([]);
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
        .get('/v1/electricity/prices/current')
        .set('X-Forwarded-For', client)
        .expect(200);
    }
    await request(app.getHttpServer())
      .get('/v1/electricity/prices/current')
      .set('X-Forwarded-For', client)
      .expect(429);
    // Another client still gets through
    await request(app.getHttpServer())
      .get('/v1/electricity/prices/current')
      .set('X-Forwarded-For', '203.0.113.8')
      .expect(200);
    // milloin-web's server-side rendering is not limited
    await request(app.getHttpServer())
      .get('/v1/electricity/prices/current')
      .set('X-Forwarded-For', client)
      .set(SSR_KEY_HEADER, 'test-ssr-key')
      .expect(200);
    await request(app.getHttpServer())
      .get('/v1/electricity/prices/current')
      .set('X-Forwarded-For', client)
      .set(SSR_KEY_HEADER, 'wrong-key')
      .expect(429);
  });
});
