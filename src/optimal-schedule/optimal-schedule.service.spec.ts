import { BadRequestException } from '@nestjs/common';
import { ElectricityPriceDto } from '../shared/electricity-price/dto/electricity-price.dto';
import { ElectricityPriceService } from '../shared/electricity-price/electricity-price.service';
import { OptimalScheduleService } from './optimal-schedule.service';

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

describe('OptimalScheduleService', () => {
  const createService = (prices: ElectricityPriceDto[]) =>
    new OptimalScheduleService({
      getTodayPrices: async () => prices,
      getTomorrowPrices: async () => {
        throw new Error('not published');
      },
    } as unknown as ElectricityPriceService);

  beforeEach(() => jest.useFakeTimers({ now: NOW }));
  afterEach(() => jest.useRealTimers());

  it('draws the energy in the cheapest hours, apart if need be', async () => {
    const service = createService(pricesFromNoon([10, 2, 9, 1, 8, 3]));

    // 11 kW for 2 h gives 2.75 kWh a slot: 20 kWh is 7 full slots and 0.75 kWh
    const result = await service.findSchedule({
      energyKwh: 20,
      maxPowerKw: 11,
    });

    expect(
      result.blocks.map((b) => [b.startTime, b.endTime, b.energyKwh]),
    ).toEqual([
      ['2025-10-01T13:00:00.000Z', '2025-10-01T14:00:00.000Z', 9],
      ['2025-10-01T15:00:00.000Z', '2025-10-01T16:00:00.000Z', 11],
    ]);
    const topUp = result.blocks[0].slots.find((slot) => slot.energyKwh < 2.75);
    expect(topUp).toMatchObject({ powerKw: 3, energyKwh: 0.75 });
    expect(result.costCents).toBe(29);
    expect(result.priceAvg).toBe(1.45);
    expect(result.pricesUntil).toBe('2025-10-01T18:00:00.000Z');
  });

  it('compares with starting right away', async () => {
    const service = createService(pricesFromNoon([10, 10, 1]));

    const result = await service.findSchedule({
      energyKwh: 11,
      maxPowerKw: 11,
    });

    expect(result.startRightAway).toEqual({
      startTime: '2025-10-01T12:00:00.000Z',
      endTime: '2025-10-01T13:00:00.000Z',
      costCents: 110,
      priceAvg: 10,
    });
    expect(result.costCents).toBe(11);
    expect(result.savingsCents).toBe(99);
  });

  it('keeps to earliestStart, deadlineAt and minConsecutiveHours', async () => {
    const service = createService(pricesFromNoon([1, 5, 2, 9, 2, 6, 1, 1]));

    const result = await service.findSchedule({
      energyKwh: 8,
      maxPowerKw: 4,
      options: {
        earliestStart: '2025-10-01T13:00:00.000Z',
        deadlineAt: '2025-10-01T18:00:00.000Z',
        minConsecutiveHours: 2,
      },
    });

    expect(result.blocks.map((b) => [b.startTime, b.endTime])).toEqual([
      ['2025-10-01T13:00:00.000Z', '2025-10-01T15:00:00.000Z'],
    ]);
    expect(result).toMatchObject({
      earliestStart: '2025-10-01T13:00:00.000Z',
      deadlineAt: '2025-10-01T18:00:00.000Z',
      minConsecutiveHours: 2,
    });
  });

  it('searches up to the last published price when the deadline is later', async () => {
    const service = createService(pricesFromNoon([5, 1]));

    const result = await service.findSchedule({
      energyKwh: 4,
      maxPowerKw: 4,
      options: { deadlineAt: '2025-10-02T05:00:00.000Z' },
    });

    expect(result.deadlineAt).toBe('2025-10-01T14:00:00.000Z');
    expect(result.blocks[0].startTime).toBe('2025-10-01T13:00:00.000Z');
  });

  it('rejects energy that does not fit before the deadline', async () => {
    const service = createService(pricesFromNoon([5, 1]));

    await expect(
      service.findSchedule({
        energyKwh: 50,
        maxPowerKw: 11,
        options: { deadlineAt: '2025-10-02T05:00:00.000Z' },
      }),
    ).rejects.toThrow(/takes 4\.75 h.*published only until/);
  });

  it('rejects a deadline before the earliest start', async () => {
    const service = createService(pricesFromNoon([5, 1]));

    await expect(
      service.findSchedule({
        energyKwh: 1,
        maxPowerKw: 4,
        options: { deadlineAt: '2025-10-01T11:00:00.000Z' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a minimum block that is not in steps of 15 minutes', async () => {
    const service = createService(pricesFromNoon([5, 1]));

    await expect(
      service.findSchedule({
        energyKwh: 1,
        maxPowerKw: 4,
        options: { minConsecutiveHours: 0.3 },
      }),
    ).rejects.toThrow(/multiple of 0.25/);
  });
});
