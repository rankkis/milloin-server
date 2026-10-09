import { ElectricityPriceDto } from '../shared/electricity-price/dto/electricity-price.dto';
import { planCheapestSchedule, slotsNeeded } from './plan-schedule.helper';

const QUARTER_MS = 15 * 60 * 1000;
const START = Date.parse('2025-10-01T12:00:00.000Z');

/** 15-minute prices in c/kWh from 12:00 UTC, as €/kWh */
const quarters = (
  cents: number[],
  skip: number[] = [],
): ElectricityPriceDto[] =>
  cents
    .map((value, q) => ({
      price: value / 100,
      startDate: new Date(START + q * QUARTER_MS).toISOString(),
      endDate: new Date(START + (q + 1) * QUARTER_MS).toISOString(),
    }))
    .filter((_, q) => !skip.includes(q));

const used = (energy: number[] | null) =>
  energy?.flatMap((kwh, i) => (kwh ? [i] : []));

describe('slotsNeeded', () => {
  it('counts full slots and the top-up', () => {
    // 11 kW gives 2.75 kWh a slot: 50 kWh is 18 full slots and 0.5 kWh
    expect(slotsNeeded(50, 11)).toEqual({ count: 19, lastKwh: 0.5 });
    expect(slotsNeeded(11, 11)).toEqual({ count: 4, lastKwh: 2.75 });
    expect(slotsNeeded(0.1, 11)).toEqual({ count: 1, lastKwh: 0.1 });
  });
});

describe('planCheapestSchedule', () => {
  it('picks the cheapest slots wherever they are', () => {
    const energy = planCheapestSchedule(quarters([9, 1, 8, 2, 7, 3, 9]), 3, 4);

    // 1 kWh a slot: the three cheapest slots
    expect(used(energy)).toEqual([1, 3, 5]);
  });

  it('tops up the rest in the dearest used slot', () => {
    const energy = planCheapestSchedule(quarters([5, 1, 2, 9]), 2.5, 4);

    expect(energy).toEqual([0.5, 1, 1, 0]);
  });

  it('keeps every block at least minBlockSlots long', () => {
    // Alone the cheapest slots are 0, 2 and 4; in pairs 3–4 and 0–1 win
    const prices = quarters([1, 5, 1, 6, 1, 2, 9]);

    expect(used(planCheapestSchedule(prices, 3, 4))).toEqual([0, 2, 4]);
    expect(used(planCheapestSchedule(prices, 4, 4, 2))).toEqual([0, 1, 4, 5]);
  });

  it('makes one block when less energy is needed than a block gives', () => {
    const energy = planCheapestSchedule(quarters([9, 1, 9, 2, 3]), 2, 4, 4);

    expect(used(energy)).toEqual([3, 4]);
  });

  it('does not run a short block over a gap in the prices', () => {
    // Without 12:30 the two cheap slots 12:15 and 12:45 are not a block
    const prices = quarters([5, 1, 9, 1, 9, 9], [2]);

    expect(used(planCheapestSchedule(prices, 2, 4))).toEqual([1, 2]);
    expect(used(planCheapestSchedule(prices, 2, 4, 2))).toEqual([0, 1]);
  });

  it('returns null when the energy does not fit', () => {
    expect(planCheapestSchedule(quarters([1, 1]), 3, 4)).toBeNull();
    expect(planCheapestSchedule(quarters([1, 1, 1], [1]), 2, 4, 2)).toBeNull();
  });

  it('matches trying every set of slots', () => {
    const cost = (prices: ElectricityPriceDto[], energy: number[]) =>
      energy.reduce((sum, kwh, i) => sum + kwh * prices[i].price, 0);
    const blocksOk = (set: number[], min: number) => {
      let run = 1;
      for (let k = 1; k <= set.length; k++) {
        if (k < set.length && set[k] === set[k - 1] + 1) run++;
        else if (run < min) return false;
        else run = 1;
      }
      return true;
    };
    let seed = 7;
    const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    for (let round = 0; round < 200; round++) {
      const n = 3 + Math.floor(random() * 7);
      const prices = quarters(
        Array.from({ length: n }, () => Math.round(random() * 20)),
      );
      const power = 4;
      const energyKwh = 0.5 + Math.round(random() * n * 2) / 2;
      const min = 1 + Math.floor(random() * 3);
      const { count, lastKwh } = slotsNeeded(energyKwh, power);
      const minBlock = Math.min(min, count);

      let best = Infinity;
      for (let mask = 0; mask < 1 << n; mask++) {
        const set = [...Array(n).keys()].filter((i) => mask & (1 << i));
        if (set.length !== count || !blocksOk(set, minBlock)) continue;
        const dearest = Math.max(...set.map((i) => prices[i].price));
        const total =
          set.reduce((sum, i) => sum + prices[i].price, 0) -
          dearest * (1 - lastKwh);
        best = Math.min(best, total);
      }

      const energy = planCheapestSchedule(prices, energyKwh, power, min);
      if (best === Infinity) {
        expect(energy).toBeNull();
      } else {
        expect(cost(prices, energy!)).toBeCloseTo(best, 9);
        expect(energy!.reduce((a, b) => a + b, 0)).toBeCloseTo(energyKwh, 9);
      }
    }
  });
});
