import { ElectricityPriceDto } from '../dto/electricity-price.dto';
import { PriceCacheService } from './price-cache.service';

const QUARTER_MS = 15 * 60 * 1000;

/** 15-minute prices from `from` up to (not including) `to`, both ISO times. */
const prices = (
  from: string,
  to: string,
  price = 0.05,
): ElectricityPriceDto[] => {
  const result: ElectricityPriceDto[] = [];
  for (let t = Date.parse(from); t < Date.parse(to); t += QUARTER_MS) {
    result.push({
      price,
      startDate: new Date(t).toISOString(),
      endDate: new Date(t + QUARTER_MS).toISOString(),
    });
  }
  return result;
};

describe('PriceCacheService', () => {
  let entsoe: { name: string; fetchPrices: jest.Mock };
  let spotHinta: { name: string; fetchPrices: jest.Mock };
  let cache: PriceCacheService;

  // Today's delivery day (Finnish time) ends 2026-10-07T22:00Z,
  // tomorrow's 2026-10-08T22:00Z.
  const todayOnly = () => prices('2026-10-07T00:00Z', '2026-10-07T22:00Z');
  const todayAndTomorrow = () =>
    prices('2026-10-07T00:00Z', '2026-10-08T22:00Z');

  const setNow = (iso: string) => jest.setSystemTime(new Date(iso));

  beforeEach(() => {
    jest.useFakeTimers();
    entsoe = { name: 'ENTSO-E', fetchPrices: jest.fn() };
    spotHinta = { name: 'spot-hinta.fi', fetchPrices: jest.fn() };
    cache = new PriceCacheService([entsoe, spotHinta]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fetches synchronously when memory is empty and keeps the result', async () => {
    setNow('2026-10-07T08:00Z'); // 11:00 in Finland
    entsoe.fetchPrices.mockResolvedValue(todayOnly());

    const first = await cache.getPrices();
    const second = await cache.getPrices();

    expect(first).toHaveLength(88);
    expect(second).toBe(first);
    expect(entsoe.fetchPrices).toHaveBeenCalledTimes(1);
    // Finnish midnight today to Finnish midnight the day after tomorrow
    expect(entsoe.fetchPrices).toHaveBeenCalledWith(
      new Date('2026-10-06T21:00Z'),
      new Date('2026-10-08T21:00Z'),
    );
  });

  it('shares one fetch between concurrent requests', async () => {
    setNow('2026-10-07T08:00Z');
    entsoe.fetchPrices.mockResolvedValue(todayOnly());

    await Promise.all([
      cache.getPrices(),
      cache.getPrices(),
      cache.getPrices(),
    ]);

    expect(entsoe.fetchPrices).toHaveBeenCalledTimes(1);
  });

  it('refetches once tomorrow prices should be published', async () => {
    setNow('2026-10-07T08:00Z');
    entsoe.fetchPrices.mockResolvedValue(todayOnly());
    await cache.getPrices();

    setNow('2026-10-07T11:30Z'); // 14:30 in Finland
    entsoe.fetchPrices.mockResolvedValue(todayAndTomorrow());
    const result = await cache.getPrices();

    expect(entsoe.fetchPrices).toHaveBeenCalledTimes(2);
    expect(result[result.length - 1].endDate).toBe('2026-10-08T22:00:00.000Z');
  });

  it('serves memory without refetching while tomorrow prices are late, then retries', async () => {
    setNow('2026-10-07T11:30Z');
    entsoe.fetchPrices.mockResolvedValue(todayOnly());
    await cache.getPrices();

    setNow('2026-10-07T11:35Z');
    await cache.getPrices();
    expect(entsoe.fetchPrices).toHaveBeenCalledTimes(1);

    setNow('2026-10-07T11:41Z');
    await cache.getPrices();
    expect(entsoe.fetchPrices).toHaveBeenCalledTimes(2);
  });

  it('falls back to spot-hinta.fi when ENTSO-E fails', async () => {
    setNow('2026-10-07T08:00Z');
    entsoe.fetchPrices.mockRejectedValue(new Error('ENTSO-E down'));
    spotHinta.fetchPrices.mockResolvedValue(
      prices('2026-10-06T21:00Z', '2026-10-07T21:00Z', 0.1),
    );

    const result = await cache.getPrices();

    expect(result[0].price).toBe(0.1);
    expect(spotHinta.fetchPrices).toHaveBeenCalledTimes(1);
  });

  it('falls back to the next provider when one returns no prices', async () => {
    setNow('2026-10-07T08:00Z');
    entsoe.fetchPrices.mockResolvedValue([]);
    spotHinta.fetchPrices.mockResolvedValue(todayOnly());

    await expect(cache.getPrices()).resolves.toHaveLength(88);
  });

  it('serves outdated memory when every source fails', async () => {
    setNow('2026-10-07T08:00Z');
    entsoe.fetchPrices.mockResolvedValue(todayOnly());
    await cache.getPrices();

    setNow('2026-10-07T12:00Z');
    entsoe.fetchPrices.mockRejectedValue(new Error('ENTSO-E down'));
    spotHinta.fetchPrices.mockRejectedValue(new Error('spot-hinta down'));

    await expect(cache.getPrices()).resolves.toHaveLength(88);
  });

  it('throws when memory is empty and every source fails', async () => {
    setNow('2026-10-07T08:00Z');
    entsoe.fetchPrices.mockRejectedValue(new Error('ENTSO-E down'));
    spotHinta.fetchPrices.mockRejectedValue(new Error('spot-hinta down'));

    await expect(cache.getPrices()).rejects.toThrow('spot-hinta down');
  });

  it('drops prices from previous Finnish days on refresh', async () => {
    setNow('2026-10-07T12:00Z');
    entsoe.fetchPrices.mockResolvedValue(
      prices('2026-10-06T21:00Z', '2026-10-08T22:00Z'),
    );
    await cache.getPrices();

    setNow('2026-10-08T12:00Z');
    entsoe.fetchPrices.mockResolvedValue(
      prices('2026-10-07T22:00Z', '2026-10-09T22:00Z'),
    );
    const result = await cache.getPrices();

    // Oct 8 starts at 2026-10-07T21:00Z in Finland
    expect(result[0].startDate).toBe('2026-10-07T21:00:00.000Z');
    expect(result[result.length - 1].endDate).toBe('2026-10-09T22:00:00.000Z');
  });

  describe('with a shared cache', () => {
    let shared: { get: jest.Mock; set: jest.Mock };

    beforeEach(() => {
      shared = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
      };
      cache = new PriceCacheService([entsoe, spotHinta], shared);
    });

    it('uses up-to-date shared prices without asking upstream', async () => {
      setNow('2026-10-07T08:00Z');
      shared.get.mockResolvedValue(todayOnly());

      const result = await cache.getPrices();

      expect(result).toHaveLength(88);
      expect(entsoe.fetchPrices).not.toHaveBeenCalled();
      expect(shared.set).not.toHaveBeenCalled();
    });

    it('fetches upstream and shares the result when shared prices are outdated', async () => {
      setNow('2026-10-07T12:00Z'); // 15:00 in Finland, tomorrow is due
      shared.get.mockResolvedValue(todayOnly());
      entsoe.fetchPrices.mockResolvedValue(todayAndTomorrow());

      const result = await cache.getPrices();

      expect(result).toHaveLength(184);
      expect(shared.set).toHaveBeenCalledWith('electricity-prices', result, {
        ttl: 2 * 24 * 60 * 60,
      });
    });

    it('fetches upstream when the shared cache fails', async () => {
      setNow('2026-10-07T08:00Z');
      shared.get.mockRejectedValue(new Error('cache down'));
      shared.set.mockRejectedValue(new Error('cache down'));
      entsoe.fetchPrices.mockResolvedValue(todayOnly());

      await expect(cache.getPrices()).resolves.toHaveLength(88);
    });
  });
});
