import { Test, TestingModule } from '@nestjs/testing';
import { ElectricityPriceModule } from '../../src/shared/electricity-price/electricity-price.module';
import { ElectricityPriceService } from '../../src/shared/electricity-price/electricity-price.service';
import { EntsoeProvider } from '../../src/shared/electricity-price/providers/entsoe.provider';

describe('Electricity prices (integration)', () => {
  let moduleFixture: TestingModule;
  let electricityPriceService: ElectricityPriceService;
  let entsoeProvider: EntsoeProvider;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [ElectricityPriceModule],
    }).compile();
    await moduleFixture.init();

    electricityPriceService = moduleFixture.get(ElectricityPriceService);
    entsoeProvider = moduleFixture.get(EntsoeProvider);
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  it('fetches today prices from ENTSO-E in 15-minute intervals', async () => {
    const now = new Date();
    const start = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

    const prices = await entsoeProvider.fetchPrices(start, end);

    expect(prices.length).toBeGreaterThanOrEqual(92);
    for (const price of prices) {
      expect(typeof price.price).toBe('number');
      expect(Date.parse(price.endDate) - Date.parse(price.startDate)).toBe(
        15 * 60 * 1000,
      );
    }
  }, 30000);

  it('serves the current price from memory', async () => {
    const [current] = await electricityPriceService.getCurrentPrices();
    const now = Date.now();

    expect(Date.parse(current.startDate)).toBeLessThanOrEqual(now);
    expect(Date.parse(current.endDate)).toBeGreaterThan(now);
  }, 30000);

  it('serves future prices sorted chronologically', async () => {
    const prices = await electricityPriceService.getFuturePrices();

    expect(prices.length).toBeGreaterThan(0);
    for (let i = 1; i < prices.length; i++) {
      expect(Date.parse(prices[i].startDate)).toBeGreaterThan(
        Date.parse(prices[i - 1].startDate),
      );
    }
  }, 30000);
});
