import { PricePoint, QUARTER_MS, byStartTime } from './price-point';
import {
  continuousPlans,
  loadProfile,
  pausablePlan,
  planState,
  runAt,
} from './plans';

const START = Date.parse('2026-10-12T00:00:00.000Z');
const at = (quarter: number) =>
  new Date(START + quarter * QUARTER_MS).toISOString();

/** 15-minute prices in c/kWh from START, one price per hour */
const hours = (cents: number[]): PricePoint[] =>
  cents
    .flatMap((price) => [price, price, price, price])
    .map((price, q) => ({ price, startTime: at(q), endTime: at(q + 1) }));

describe('loadProfile', () => {
  it('spreads energy evenly over a duration', () => {
    expect(loadProfile({ durationHours: 1, energyKwh: 2 })).toEqual({
      slotKwh: [0.5, 0.5, 0.5, 0.5],
      hasEnergy: true,
    });
  });

  it('weighs slots equally without energy', () => {
    expect(loadProfile({ durationHours: 0.5 })).toEqual({
      slotKwh: [1, 1],
      hasEnergy: false,
    });
  });

  it('runs at full power until the energy is in', () => {
    // 11 kW gives 2.75 kWh a slot: 6 kWh is 2 full slots and 0.5 kWh
    expect(loadProfile({ energyKwh: 6, maxPowerKw: 11 }).slotKwh).toEqual([
      2.75, 2.75, 0.5,
    ]);
  });
});

describe('continuousPlans', () => {
  it('ranks runs that do not overlap, cheapest first', () => {
    const plans = continuousPlans(
      hours([10, 9, 2, 3, 8, 1, 1, 9]),
      loadProfile({ durationHours: 2, energyKwh: 2 }),
      3,
    );

    expect(plans.map((plan) => [plan.blocks[0].startTime, plan.cost])).toEqual([
      [at(20), 2],
      [at(8), 5],
      [at(0), 19],
    ]);
  });

  it('costs a full-power run with its top-up last', () => {
    const [plan] = continuousPlans(
      hours([10, 1]),
      loadProfile({ energyKwh: 6, maxPowerKw: 11 }),
      1,
    );

    // 3 slots starting in the cheap hour's first quarter
    expect(plan.blocks[0].startTime).toBe(at(4));
    expect(plan.cost).toBeCloseTo(6);
  });
});

describe('pausablePlan', () => {
  it('picks the cheapest hours apart, in blocks', () => {
    const plan = pausablePlan(
      hours([9, 1, 8, 1, 9]),
      loadProfile({ durationHours: 2, energyKwh: 4 }),
      4,
    );

    expect(plan.blocks).toEqual([
      { startTime: at(4), endTime: at(8), energyKwh: 2, cost: 2 },
      { startTime: at(12), endTime: at(16), energyKwh: 2, cost: 2 },
    ]);
    expect(plan.cost).toBe(4);
  });

  it('keeps blocks at least minBlockSlots long', () => {
    const plan = pausablePlan(
      hours([9, 1, 8, 1, 9]),
      loadProfile({ durationHours: 2 }),
      8,
    );

    expect(plan.blocks).toHaveLength(1);
  });

  it('is undefined when the load does not fit', () => {
    expect(
      pausablePlan(hours([1]), loadProfile({ durationHours: 2 }), 1),
    ).toBeUndefined();
  });
});

describe('runAt', () => {
  it('is undefined over a missing price', () => {
    const byStart = byStartTime(hours([1, 2]));

    expect(
      runAt(byStart, START + 4 * QUARTER_MS, loadProfile({ durationHours: 1 }))
        ?.cost,
    ).toBe(8);
    expect(
      runAt(byStart, START + 5 * QUARTER_MS, loadProfile({ durationHours: 1 })),
    ).toBeUndefined();
  });
});

describe('planState', () => {
  const plan = pausablePlan(
    hours([9, 1, 8, 1, 9]),
    loadProfile({ durationHours: 2 }),
    4,
  );

  it.each([
    [0, false, at(4)],
    [5, true, at(8)],
    [9, false, at(12)],
    [13, true, at(16)],
  ])('at quarter %p is active %p, next change %p', (quarter, active, next) => {
    expect(planState(plan, START + quarter * QUARTER_MS)).toEqual({
      activeNow: active,
      nextChangeAt: next,
    });
  });

  it('has no next change once the plan is over', () => {
    expect(planState(plan, START + 17 * QUARTER_MS)).toEqual({
      activeNow: false,
    });
  });
});
