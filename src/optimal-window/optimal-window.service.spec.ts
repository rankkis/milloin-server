import { BadRequestException } from '@nestjs/common';
import { ElectricityPriceDto } from '../shared/electricity-price/dto/electricity-price.dto';
import { ElectricityPriceService } from '../shared/electricity-price/electricity-price.service';
import { OptimalWindowService } from './optimal-window.service';

const QUARTER_MS = 15 * 60 * 1000;
const HOUR_MS = 4 * QUARTER_MS;
// 12:05 UTC, inside the 12:00 quarter
const NOW = Date.parse('2025-10-01T12:05:00.000Z');

/** Hourly prices in c/kWh from 12:00 UTC, as 15-minute prices in €/kWh */
const pricesFromNoon = (hourly: number[]): ElectricityPriceDto[] =>
  hourly.flatMap((cents, hour) =>
    [0, 1, 2, 3].map((quarter) => {
      const start =
        Date.parse('2025-10-01T12:00:00.000Z') +
        hour * HOUR_MS +
        quarter * QUARTER_MS;
      return {
        price: cents / 100,
        startDate: new Date(start).toISOString(),
        endDate: new Date(start + QUARTER_MS).toISOString(),
      };
    }),
  );

describe('OptimalWindowService', () => {
  const createService = (prices: ElectricityPriceDto[]) =>
    new OptimalWindowService({
      getTodayPrices: async () => prices,
      getTomorrowPrices: async () => {
        throw new Error('not published');
      },
    } as unknown as ElectricityPriceService);

  beforeEach(() => jest.useFakeTimers({ now: NOW }));
  afterEach(() => jest.useRealTimers());

  it('returns non-overlapping windows, cheapest first', async () => {
    const service = createService(pricesFromNoon([10, 9, 2, 3, 8, 1, 1, 9]));

    const result = await service.findWindows({ durationHours: 2, count: 3 });

    expect(result.windows.map((w) => [w.startTime, w.priceAvg])).toEqual([
      ['2025-10-01T17:00:00.000Z', 1],
      ['2025-10-01T14:00:00.000Z', 2.5],
      ['2025-10-01T12:00:00.000Z', 9.5],
    ]);
    expect(result.earliestStart).toBe('2025-10-01T12:00:00.000Z');
    expect(result.latestEnd).toBe('2025-10-01T20:00:00.000Z');
  });

  it('costs each window and its saving against starting now', async () => {
    const service = createService(pricesFromNoon([10, 10, 2, 2]));

    const result = await service.findWindows({
      durationHours: 2,
      energyKwh: 1.5,
      count: 1,
    });

    expect(result.startNow).toMatchObject({ priceAvg: 10, costCents: 15 });
    expect(result.windows[0]).toMatchObject({
      startTime: '2025-10-01T14:00:00.000Z',
      costCents: 3,
      savingsCents: 12,
    });
  });

  it('leaves cost out without energyKwh', async () => {
    const service = createService(pricesFromNoon([5, 5]));

    const result = await service.findWindows({ durationHours: 1 });

    expect(result.windows[0].costCents).toBeUndefined();
    expect(result.windows[0].savingsCents).toBeUndefined();
  });

  it('searches only between earliestStart and latestEnd', async () => {
    const service = createService(pricesFromNoon([1, 5, 6, 7, 1]));

    const result = await service.findWindows({
      durationHours: 1,
      earliestStart: '2025-10-01T13:00:00.000Z',
      latestEnd: '2025-10-01T16:00:00.000Z',
      count: 1,
    });

    expect(result.windows[0].startTime).toBe('2025-10-01T13:00:00.000Z');
  });

  it('returns no windows when none fits', async () => {
    const service = createService(pricesFromNoon([5, 5]));

    const result = await service.findWindows({ durationHours: 3 });

    expect(result.windows).toEqual([]);
    expect(result.startNow).toBeUndefined();
  });

  it('rejects a duration that is not whole quarter hours', async () => {
    const service = createService(pricesFromNoon([5, 5]));

    await expect(service.findWindows({ durationHours: 1.1 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a latestEnd before earliestStart', async () => {
    const service = createService(pricesFromNoon([5, 5]));

    await expect(
      service.findWindows({
        durationHours: 1,
        latestEnd: '2025-10-01T11:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
