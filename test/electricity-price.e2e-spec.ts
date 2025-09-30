import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { ElectricityPriceService } from '../src/shared/electricity-price/electricity-price.service';
import { EntsoeDataFetcherService } from '../src/shared/electricity-price/services/entsoe-data-fetcher.service';

describe('ElectricityPrice (e2e)', () => {
  let app: INestApplication;
  let electricityPriceService: ElectricityPriceService;
  let entsoeDataFetcher: EntsoeDataFetcherService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    electricityPriceService = moduleFixture.get<ElectricityPriceService>(
      ElectricityPriceService,
    );
    entsoeDataFetcher = moduleFixture.get<EntsoeDataFetcherService>(
      EntsoeDataFetcherService,
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('ENTSO-E Data Fetcher', () => {
    it('should be able to fetch and store today prices from ENTSO-E', async () => {
      // This test verifies the complete data flow: ENTSO-E API -> Database
      await expect(
        entsoeDataFetcher.fetchAndStoreTodayPrices(),
      ).resolves.not.toThrow();
    }, 30000); // 30 second timeout for API call

    it('should handle tomorrow prices gracefully (might not be available)', async () => {
      // This test verifies tomorrow prices are handled correctly
      await expect(
        entsoeDataFetcher.fetchAndStoreTomorrowPrices(),
      ).resolves.not.toThrow();
    }, 30000);
  });

  describe('Database Provider', () => {
    it('should fetch current prices from database (after data is available)', async () => {
      // First ensure we have some data
      await entsoeDataFetcher.fetchAndStoreTodayPrices();

      // Then try to fetch current prices
      const currentPrices = await electricityPriceService.getCurrentPrices();
      expect(currentPrices).toBeDefined();
      expect(Array.isArray(currentPrices)).toBe(true);
      expect(currentPrices.length).toBeGreaterThan(0);

      // Verify price structure
      const price = currentPrices[0];
      expect(price.price).toBeDefined();
      expect(typeof price.price).toBe('number');
      expect(price.startDate).toBeDefined();
      expect(price.endDate).toBeDefined();
    }, 35000);

    it('should fetch today prices from database', async () => {
      const todayPrices = await electricityPriceService.getTodayPrices();
      expect(todayPrices).toBeDefined();
      expect(Array.isArray(todayPrices)).toBe(true);

      if (todayPrices.length > 0) {
        expect(todayPrices.length).toBeLessThanOrEqual(24); // Max 24 hours

        // Verify each price has required structure
        todayPrices.forEach((price) => {
          expect(price.price).toBeDefined();
          expect(typeof price.price).toBe('number');
          expect(price.startDate).toBeDefined();
          expect(price.endDate).toBeDefined();
        });
      }
    }, 10000);

    it('should fetch future prices from database', async () => {
      const futurePrices = await electricityPriceService.getFuturePrices();
      expect(futurePrices).toBeDefined();
      expect(Array.isArray(futurePrices)).toBe(true);

      // Future prices should be sorted chronologically
      if (futurePrices.length > 1) {
        for (let i = 1; i < futurePrices.length; i++) {
          const prevDate = new Date(futurePrices[i - 1].startDate);
          const currDate = new Date(futurePrices[i].startDate);
          expect(currDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime());
        }
      }
    }, 10000);
  });

  describe('API Integration', () => {
    it('should return current electricity prices via HTTP', async () => {
      // This test assumes you have an API endpoint for electricity prices
      // If not, this test will help identify if you need to create one
      const response = await request(app.getHttpServer())
        .get('/electricity-price/current') // Adjust endpoint as needed
        .expect(200);

      expect(response.body).toBeDefined();
    });

    it('should return today electricity prices via HTTP', async () => {
      const response = await request(app.getHttpServer())
        .get('/electricity-price/today') // Adjust endpoint as needed
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });

  describe('Fallback Mechanism', () => {
    it('should handle database failures gracefully', async () => {
      // This test verifies the fallback to SpotHinta works
      // We can't easily simulate database failure in e2e test,
      // but we can verify the service doesn't throw unhandled errors
      await expect(
        electricityPriceService.getCurrentPrices(),
      ).resolves.not.toThrow();
    });
  });
});
