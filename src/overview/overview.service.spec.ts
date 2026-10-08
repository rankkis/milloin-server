import { Test } from '@nestjs/testing';
import { OverviewService } from './overview.service';
import { ElectricityPriceService } from '../shared/electricity-price/electricity-price.service';
import { ElectricityPriceDto } from '../shared/electricity-price/dto/electricity-price.dto';
import { PriceCategory } from '../shared/dto/price-category.enum';

const QUARTER_MS = 15 * 60 * 1000;

/**
 * Consecutive 15-minute prices from `start`.
 * @param priceForQuarter - Price in EUR/kWh for each quarter index
 */
const quarters = (
  start: string,
  count: number,
  priceForQuarter: (q: number) => number,
): ElectricityPriceDto[] =>
  Array.from({ length: count }, (_, q) => {
    const startMs = Date.parse(start) + q * QUARTER_MS;
    return {
      price: priceForQuarter(q),
      startDate: new Date(startMs).toISOString(),
      endDate: new Date(startMs + QUARTER_MS).toISOString(),
    };
  });

describe('OverviewService', () => {
  let service: OverviewService;
  let prices: jest.Mocked<
    Pick<
      ElectricityPriceService,
      | 'getCurrentPrices'
      | 'getFuturePrices'
      | 'getTodayPrices'
      | 'getTomorrowPrices'
    >
  >;

  /** Mocks the price service as the cache would answer at `now` */
  const givenPrices = (
    now: string,
    today: ElectricityPriceDto[],
    tomorrow: ElectricityPriceDto[] = [],
  ) => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(new Date(now));
    const all = [...today, ...tomorrow];
    const nowMs = Date.parse(now);
    prices.getTodayPrices.mockResolvedValue(today);
    prices.getTomorrowPrices.mockResolvedValue(tomorrow);
    prices.getFuturePrices.mockResolvedValue(
      all.filter((p) => Date.parse(p.startDate) >= nowMs),
    );
    prices.getCurrentPrices.mockResolvedValue(
      all.filter(
        (p) =>
          Date.parse(p.startDate) <= nowMs && Date.parse(p.endDate) > nowMs,
      ),
    );
  };

  beforeEach(async () => {
    prices = {
      getCurrentPrices: jest.fn(),
      getFuturePrices: jest.fn(),
      getTodayPrices: jest.fn(),
      getTomorrowPrices: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        OverviewService,
        { provide: ElectricityPriceService, useValue: prices },
      ],
    }).compile();

    service = moduleRef.get(OverviewService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('today', () => {
    // 2026-07-15 00:00 Finnish summer time (UTC+3)
    const DAY_START = '2026-07-14T21:00:00.000Z';

    it('returns 24 hourly averages from Finnish midnight, past hours included', async () => {
      // Each hour's quarters cost 1, 2, 3 and 4 cents, plus the hour index
      givenPrices(
        '2026-07-15T09:20:00.000Z', // 12:20 Finnish time
        quarters(DAY_START, 96, (q) => (Math.floor(q / 4) + (q % 4) + 1) / 100),
      );

      const { today } = await service.getOverview();

      expect(today).toHaveLength(24);
      expect(today[0]).toEqual({
        startTime: DAY_START,
        endTime: '2026-07-14T22:00:00.000Z',
        priceAvg: 2.5,
        priceCategory: PriceCategory.CHEAP,
      });
      expect(today[23].startTime).toBe('2026-07-15T20:00:00.000Z');
      expect(today[23].priceAvg).toBe(25.5);
      expect(today[23].priceCategory).toBe(PriceCategory.VERY_EXPENSIVE);
    });

    it('returns 25 hours on the day daylight saving time ends', async () => {
      // 2026-10-25 00:00 Finnish summer time; clocks go back at 04:00
      const dstEndStart = '2026-10-24T21:00:00.000Z';
      givenPrices(
        '2026-10-25T10:00:00.000Z',
        quarters(dstEndStart, 100, () => 0.05),
      );

      const { today } = await service.getOverview();

      expect(today).toHaveLength(25);
      expect(today[24].endTime).toBe('2026-10-25T22:00:00.000Z');
    });

    it('leaves out hours without published prices', async () => {
      givenPrices(
        '2026-07-14T21:30:00.000Z',
        quarters(DAY_START, 8, () => 0.05),
      );

      const { today } = await service.getOverview();

      expect(today).toHaveLength(2);
    });
  });

  describe('upcomingHours', () => {
    // 2026-07-15 00:00 Finnish summer time (UTC+3)
    const DAY_START = '2026-07-14T21:00:00.000Z';
    const TOMORROW_START = '2026-07-15T21:00:00.000Z';

    it('starts at the current hour, its past quarters included', async () => {
      // Quarters cost 1, 2, 3 and 4 cents within each hour
      givenPrices(
        '2026-07-15T09:40:00.000Z', // 12:40 Finnish time
        quarters(DAY_START, 96, (q) => ((q % 4) + 1) / 100),
      );

      const { upcomingHours } = await service.getOverview();

      expect(upcomingHours).toHaveLength(12);
      expect(upcomingHours[0]).toEqual({
        startTime: '2026-07-15T09:00:00.000Z',
        endTime: '2026-07-15T10:00:00.000Z',
        priceAvg: 2.5,
        priceCategory: PriceCategory.CHEAP,
      });
      expect(upcomingHours[11].endTime).toBe(TOMORROW_START);
    });

    it("runs to the end of tomorrow's prices once they are published", async () => {
      givenPrices(
        '2026-07-15T11:00:00.000Z',
        quarters(DAY_START, 96, () => 0.05),
        quarters(TOMORROW_START, 96, () => 0.02),
      );

      const { upcomingHours } = await service.getOverview();

      expect(upcomingHours).toHaveLength(34);
      expect(upcomingHours[33]).toEqual({
        startTime: '2026-07-16T20:00:00.000Z',
        endTime: '2026-07-16T21:00:00.000Z',
        priceAvg: 2,
        priceCategory: PriceCategory.VERY_CHEAP,
      });
    });
  });

  describe('cheapestWindow', () => {
    const DAY_START = '2026-07-14T21:00:00.000Z';

    it('is the cheapest 2-hour window that has not ended yet', async () => {
      // Cheapest at 02:00-04:00 Finnish time (already past),
      // next cheapest at 15:00-17:00 Finnish time
      const price = (q: number) => {
        const hour = Math.floor(q / 4);
        if (hour === 2 || hour === 3) return 0.01;
        if (hour === 15 || hour === 16) return 0.02;
        return 0.08;
      };
      givenPrices('2026-07-15T10:42:00.000Z', quarters(DAY_START, 96, price));

      const { cheapestWindow } = await service.getOverview();

      expect(cheapestWindow.startTime).toBe('2026-07-15T12:00:00.000Z');
      expect(cheapestWindow.endTime).toBe('2026-07-15T14:00:00.000Z');
      expect(cheapestWindow.priceAvg).toBe(2);
      expect(cheapestWindow.pricePoints).toHaveLength(8);
    });

    it("includes tomorrow's prices when they are published", async () => {
      const today = quarters(DAY_START, 96, () => 0.08);
      const tomorrow = quarters('2026-07-15T21:00:00.000Z', 96, (q) =>
        q >= 12 && q < 20 ? 0.01 : 0.08,
      );
      givenPrices('2026-07-15T15:00:00.000Z', today, tomorrow);

      const { cheapestWindow } = await service.getOverview();

      // 03:00-05:00 Finnish time tomorrow
      expect(cheapestWindow.startTime).toBe('2026-07-16T00:00:00.000Z');
    });

    it('can start in the current quarter hour', async () => {
      givenPrices(
        '2026-07-15T10:05:00.000Z',
        quarters(DAY_START, 96, (q) => (q >= 52 && q < 60 ? 0.01 : 0.08)),
      );

      const { cheapestWindow } = await service.getOverview();

      expect(cheapestWindow.startTime).toBe('2026-07-15T10:00:00.000Z');
    });

    it('is left out when less than 2 hours of prices remain', async () => {
      givenPrices(
        '2026-07-15T19:30:00.000Z',
        quarters(DAY_START, 96, () => 0.05),
      );

      const result = await service.getOverview();

      expect(result.cheapestWindow).toBeUndefined();
      expect('cheapestWindow' in result).toBe(false);
    });
  });
});
