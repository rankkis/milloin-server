import { Test } from '@nestjs/testing';
import { WashLaundryService } from './wash-laundry.service';
import { ElectricityPriceService } from '../shared/electricity-price/electricity-price.service';
import { ElectricityPriceDto } from '../shared/electricity-price/dto/electricity-price.dto';
import { PriceCategory } from '../shared/dto/price-category.enum';

const QUARTER_MS = 15 * 60 * 1000;
const HOUR_MS = 4 * QUARTER_MS;

// Finnish summer time is UTC+3, so a Finnish day starts at 21:00Z the day before
const TODAY_START = '2025-07-14T21:00:00.000Z'; // 2025-07-15 00:00 Finnish
const TOMORROW_START = '2025-07-15T21:00:00.000Z'; // 2025-07-16 00:00 Finnish

/** Finnish clock time on 2025-07-15 as a UTC instant */
const finnishTime = (hour: number, minute = 0): Date =>
  new Date(new Date(TODAY_START).getTime() + hour * HOUR_MS + minute * 60000);

/**
 * Creates a Finnish day of 15-minute prices.
 * @param dayStart - UTC instant of 00:00 Finnish time
 * @param priceForHour - Price in EUR/kWh for each Finnish hour (0-23)
 */
const finnishDay = (
  dayStart: string,
  priceForHour: (hour: number) => number,
): ElectricityPriceDto[] => {
  const base = new Date(dayStart).getTime();
  return Array.from({ length: 96 }, (_, q) => {
    const start = base + q * QUARTER_MS;
    return {
      price: priceForHour(Math.floor(q / 4)),
      startDate: new Date(start).toISOString(),
      endDate: new Date(start + QUARTER_MS).toISOString(),
    };
  });
};

/** Flat price with optional cheap hours */
const pricing =
  (base: number, cheap: Record<number, number> = {}) =>
  (hour: number) =>
    cheap[hour] ?? base;

/** Finnish hour of an ISO timestamp on summer time */
const finnishHour = (iso: string): number =>
  (new Date(iso).getUTCHours() + 3) % 24;

describe('WashLaundryService', () => {
  let service: WashLaundryService;
  let prices: jest.Mocked<
    Pick<ElectricityPriceService, 'getTodayPrices' | 'getTomorrowPrices'>
  >;

  const givenPrices = (
    today: ElectricityPriceDto[],
    tomorrow: ElectricityPriceDto[] | Error = [],
  ) => {
    prices.getTodayPrices.mockResolvedValue(today);
    if (tomorrow instanceof Error) {
      prices.getTomorrowPrices.mockRejectedValue(tomorrow);
    } else {
      prices.getTomorrowPrices.mockResolvedValue(tomorrow);
    }
  };

  beforeEach(async () => {
    prices = {
      getTodayPrices: jest.fn(),
      getTomorrowPrices: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        WashLaundryService,
        { provide: ElectricityPriceService, useValue: prices },
      ],
    }).compile();

    service = moduleRef.get(WashLaundryService);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const at = (date: Date) => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    jest.setSystemTime(date);
  };

  describe('now', () => {
    it('returns the cost of a 2-hour wash starting from the current quarter', async () => {
      at(finnishTime(10, 20));
      givenPrices(
        finnishDay(TODAY_START, pricing(0.1, { 10: 0.04, 11: 0.08 })),
      );

      const result = await service.getOptimalSchedule();

      expect(result.now).toBeDefined();
      expect(result.now.startTime).toBe(finnishTime(10, 15).toISOString());
      expect(result.now.endTime).toBe(finnishTime(12, 15).toISOString());
      expect(result.now.pricePoints).toHaveLength(8);
      // 3 quarters at 4, 4 at 8 and 1 at 10 cents = 54 / 8
      expect(result.now.priceAvg).toBe(6.75);
    });

    it('is left out when less than 2 hours of prices remain', async () => {
      at(finnishTime(23, 0));
      givenPrices(finnishDay(TODAY_START, pricing(0.1)));

      const result = await service.getOptimalSchedule();

      expect(result.now).toBeUndefined();
    });
  });

  describe('startDelays', () => {
    it('costs a 2-hour wash from the current quarter and after 1 to 5 hours', async () => {
      at(finnishTime(10, 20));
      givenPrices(
        finnishDay(TODAY_START, pricing(0.1, { 11: 0.04, 12: 0.04 })),
      );

      const { startDelays } = await service.getOptimalSchedule();

      expect(startDelays.map((d) => d.delayHours)).toEqual([0, 1, 2, 3, 4, 5]);
      expect(startDelays[1]).toEqual({
        delayHours: 1,
        startTime: finnishTime(11, 15).toISOString(),
        endTime: finnishTime(13, 15).toISOString(),
        // 7 quarters at 4 cents and 1 at 10 = 38 / 8
        priceAvg: 4.75,
        priceCategory: PriceCategory.CHEAP,
        // 4.75 c/kWh × 1.5 kWh
        costCents: 7.13,
        isBest: true,
      });
      // 3 quarters at 10 cents and 5 at 4 = 50 / 8
      expect(startDelays[0].priceAvg).toBe(6.25);
      expect(startDelays.filter((d) => d.isBest)).toHaveLength(1);
    });

    it('skips only the delays whose program overlaps a missing quarter', async () => {
      at(finnishTime(10));
      // 13:30-13:45 Finnish time is missing
      const gap = finnishTime(13, 30).toISOString();
      givenPrices(
        finnishDay(TODAY_START, pricing(0.1)).filter(
          (p) => p.startDate !== gap,
        ),
      );

      const { startDelays } = await service.getOptimalSchedule();

      // +2 (12:00-14:00) and +3 (13:00-15:00) cover the gap
      expect(startDelays.map((d) => d.delayHours)).toEqual([0, 1, 4, 5]);
    });

    it('prefers the earliest delay on a tie', async () => {
      at(finnishTime(10));
      givenPrices(finnishDay(TODAY_START, pricing(0.1)));

      const { startDelays } = await service.getOptimalSchedule();

      expect(startDelays[0].isBest).toBe(true);
      expect(startDelays.filter((d) => d.isBest)).toHaveLength(1);
    });

    it('uses 1.5 kWh per wash for the cost', async () => {
      at(finnishTime(10));
      givenPrices(finnishDay(TODAY_START, pricing(0.04)));

      const { startDelays, defaults } = await service.getOptimalSchedule();

      expect(defaults.powerConsumptionKwh).toBe(1.5);
      expect(startDelays[0].costCents).toBe(6);
    });

    it("continues into tomorrow's prices", async () => {
      at(finnishTime(21));
      givenPrices(
        finnishDay(TODAY_START, pricing(0.1)),
        finnishDay(TOMORROW_START, pricing(0.1, { 0: 0.01, 1: 0.01 })),
      );

      const { startDelays } = await service.getOptimalSchedule();

      expect(startDelays).toHaveLength(6);
      expect(startDelays.find((d) => d.isBest).delayHours).toBe(3);
    });

    it('leaves out delays that would run past the published prices', async () => {
      at(finnishTime(20, 30));
      givenPrices(finnishDay(TODAY_START, pricing(0.1)));

      const { startDelays } = await service.getOptimalSchedule();

      // 20:30 + 1 h + 2 h = 23:30 fits, 20:30 + 2 h + 2 h does not
      expect(startDelays.map((d) => d.delayHours)).toEqual([0, 1]);
    });

    it('is empty when less than 2 hours of prices remain', async () => {
      at(finnishTime(23, 0));
      givenPrices(finnishDay(TODAY_START, pricing(0.1)));

      const { startDelays } = await service.getOptimalSchedule();

      expect(startDelays).toEqual([]);
    });
  });

  describe('today', () => {
    it('is the cheapest daytime window when it is daytime', async () => {
      at(finnishTime(10));
      givenPrices(
        finnishDay(TODAY_START, pricing(0.1, { 13: 0.03, 14: 0.03 })),
      );

      const result = await service.getOptimalSchedule();

      expect(result.today).toBeDefined();
      expect(result.today.startTime).toBe(finnishTime(13).toISOString());
      expect(result.today.priceAvg).toBe(3);
    });

    it('ignores daytime hours that have already passed', async () => {
      at(finnishTime(10));
      givenPrices(finnishDay(TODAY_START, pricing(0.1, { 7: 0.01, 8: 0.01 })));

      const result = await service.getOptimalSchedule();

      expect(new Date(result.today.startTime).getTime()).toBeGreaterThanOrEqual(
        finnishTime(10).getTime(),
      );
    });

    it.each([
      ['22:00', 22],
      ['05:00', 5],
    ])('is left out at night (%s Finnish time)', async (_label, hour) => {
      at(finnishTime(hour));
      givenPrices(finnishDay(TODAY_START, pricing(0.1)));

      const result = await service.getOptimalSchedule();

      expect(result.today).toBeUndefined();
    });
  });

  describe('tonight', () => {
    it('is included when it is cheaper than today', async () => {
      at(finnishTime(10));
      givenPrices(
        finnishDay(TODAY_START, pricing(0.1, { 22: 0.02, 23: 0.02 })),
        finnishDay(TOMORROW_START, pricing(0.1)),
      );

      const result = await service.getOptimalSchedule();

      expect(result.tonight).toBeDefined();
      expect(finnishHour(result.tonight.startTime)).toBe(22);
      expect(result.tonight.priceAvg).toBe(2);
    });

    it('is left out when it is more expensive than today', async () => {
      at(finnishTime(10));
      givenPrices(
        finnishDay(TODAY_START, pricing(0.1, { 13: 0.02, 14: 0.02 })),
        finnishDay(TOMORROW_START, pricing(0.1)),
      );

      const result = await service.getOptimalSchedule();

      expect(result.today.priceAvg).toBe(2);
      expect(result.tonight).toBeUndefined();
    });

    it('is included at night even without today to compare to', async () => {
      at(finnishTime(22));
      givenPrices(
        finnishDay(TODAY_START, pricing(0.1)),
        finnishDay(TOMORROW_START, pricing(0.1, { 2: 0.01, 3: 0.01 })),
      );

      const result = await service.getOptimalSchedule();

      expect(result.tonight).toBeDefined();
      expect(finnishHour(result.tonight.startTime)).toBe(2);
    });
  });

  describe('tomorrow', () => {
    it('is included at night when today is not available', async () => {
      at(finnishTime(22));
      givenPrices(
        finnishDay(TODAY_START, pricing(0.1)),
        finnishDay(TOMORROW_START, pricing(0.1, { 12: 0.05, 13: 0.05 })),
      );

      const result = await service.getOptimalSchedule();

      expect(result.tomorrow).toBeDefined();
      expect(finnishHour(result.tomorrow.startTime)).toBe(12);
    });

    it('is included during the day when it is cheaper than today', async () => {
      at(finnishTime(10));
      givenPrices(
        finnishDay(TODAY_START, pricing(0.1)),
        finnishDay(TOMORROW_START, pricing(0.1, { 9: 0.02, 10: 0.02 })),
      );

      const result = await service.getOptimalSchedule();

      expect(result.tomorrow).toBeDefined();
      expect(result.tomorrow.priceAvg).toBe(2);
    });

    it('is left out during the day when it is more expensive than today', async () => {
      at(finnishTime(10));
      givenPrices(
        finnishDay(TODAY_START, pricing(0.1, { 14: 0.02, 15: 0.02 })),
        finnishDay(TOMORROW_START, pricing(0.1)),
      );

      const result = await service.getOptimalSchedule();

      expect(result.tomorrow).toBeUndefined();
    });

    it('is left out when equal to today', async () => {
      at(finnishTime(10));
      givenPrices(
        finnishDay(TODAY_START, pricing(0.1)),
        finnishDay(TOMORROW_START, pricing(0.1)),
      );

      const result = await service.getOptimalSchedule();

      expect(result.today).toBeDefined();
      expect(result.tomorrow).toBeUndefined();
      expect(result.tonight).toBeUndefined();
    });

    it("still answers when tomorrow's prices are not published yet", async () => {
      at(finnishTime(10));
      givenPrices(
        finnishDay(TODAY_START, pricing(0.1)),
        new Error('Not published'),
      );

      const result = await service.getOptimalSchedule();

      expect(result.today).toBeDefined();
      expect(result.tomorrow).toBeUndefined();
    });
  });

  it('returns the calculation defaults', async () => {
    at(finnishTime(10));
    givenPrices(finnishDay(TODAY_START, pricing(0.1)));

    const result = await service.getOptimalSchedule();

    expect(result.defaults.periodHours).toBe(2);
    expect(result.defaults.powerConsumptionKwh).toBeGreaterThan(0);
  });
});
