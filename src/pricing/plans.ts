import { PricePoint, QUARTER_MS, byStartTime } from './price-point';
import { planCheapestSchedule, slotsNeeded } from './schedule';

/**
 * Energy drawn in each 15-minute slot of a run, in kWh. Without a known
 * energy each slot weighs 1, so costs rank like average prices.
 */
export interface LoadProfile {
  slotKwh: number[];
  /** Whether slotKwh is real energy, so costs can be shown */
  hasEnergy: boolean;
}

/** A run of consecutive slots */
export interface PlanBlock {
  startTime: string;
  endTime: string;
  /** kWh, or slot weights when the profile has no energy */
  energyKwh: number;
  /** Cents (energy × c/kWh), or weighted price sum without energy */
  cost: number;
}

/** When to run a load: one block if continuous, one or more if pausable */
export interface Plan {
  blocks: PlanBlock[];
  energyKwh: number;
  cost: number;
}

/**
 * Even energy over a duration (energyKwh may be left out), or full power
 * until the energy is in with the last slot topping up the rest.
 */
export function loadProfile(load: {
  durationHours?: number;
  energyKwh?: number;
  maxPowerKw?: number;
}): LoadProfile {
  if (load.durationHours !== undefined) {
    const count = Math.round(load.durationHours * 4);
    const perSlot = load.energyKwh !== undefined ? load.energyKwh / count : 1;
    return {
      slotKwh: Array(count).fill(perSlot),
      hasEnergy: load.energyKwh !== undefined,
    };
  }
  const { count, lastKwh } = slotsNeeded(load.energyKwh, load.maxPowerKw);
  return {
    slotKwh: Array.from({ length: count }, (_, q) =>
      q === count - 1 ? lastKwh : load.maxPowerKw / 4,
    ),
    hasEnergy: true,
  };
}

const sum = (values: number[]): number =>
  values.reduce((total, value) => total + value, 0);

/**
 * The run starting at `start` with the profile, or undefined when a price
 * on the way is missing.
 */
export function runAt(
  byStart: Map<number, PricePoint>,
  start: number,
  profile: LoadProfile,
): Plan | undefined {
  let cost = 0;
  for (let q = 0; q < profile.slotKwh.length; q++) {
    const price = byStart.get(start + q * QUARTER_MS);
    if (!price) return undefined;
    cost += price.price * profile.slotKwh[q];
  }
  const energyKwh = sum(profile.slotKwh);
  const block: PlanBlock = {
    startTime: new Date(start).toISOString(),
    endTime: new Date(
      start + profile.slotKwh.length * QUARTER_MS,
    ).toISOString(),
    energyKwh,
    cost,
  };
  return { blocks: [block], energyKwh, cost };
}

/**
 * Continuous runs that do not overlap each other, cheapest first; on a tie
 * the earlier run comes first.
 */
export function continuousPlans(
  prices: PricePoint[],
  profile: LoadProfile,
  limit: number,
): Plan[] {
  const byStart = byStartTime(prices);
  const runs = prices
    .map((price) => runAt(byStart, Date.parse(price.startTime), profile))
    .filter((run): run is Plan => run !== undefined)
    .sort((a, b) => a.cost - b.cost);

  const picked: Plan[] = [];
  for (const run of runs) {
    if (picked.length === limit) break;
    const [block] = run.blocks;
    const overlaps = picked.some(
      ({ blocks: [taken] }) =>
        block.startTime < taken.endTime && taken.startTime < block.endTime,
    );
    if (!overlaps) picked.push(run);
  }
  return picked;
}

/**
 * The cheapest way to run the profile's slots in blocks of at least
 * minBlockSlots, pausing in between. All slots but the last draw the same
 * energy; the last tops up the rest. Undefined when it does not fit.
 */
export function pausablePlan(
  prices: PricePoint[],
  profile: LoadProfile,
  minBlockSlots: number,
): Plan | undefined {
  const count = profile.slotKwh.length;
  const fullKwh = profile.slotKwh[0];
  const energyKwh = sum(profile.slotKwh);
  const energy = planCheapestSchedule(
    prices,
    energyKwh,
    fullKwh * 4,
    Math.min(minBlockSlots, count),
  );
  if (!energy) return undefined;

  // Runs of consecutive slots; in each the device runs at full power from
  // the start until the run's energy is in, so its top-up comes last
  const runs: number[][] = [];
  energy.forEach((kwh, i) => {
    if (!kwh) return;
    const run = runs[runs.length - 1];
    const previous = run?.[run.length - 1];
    if (
      previous === i - 1 &&
      prices[previous].endTime === prices[i].startTime
    ) {
      run.push(i);
    } else {
      runs.push([i]);
    }
  });
  const blocks = runs.map((run): PlanBlock => {
    const runKwh = sum(run.map((i) => energy[i]));
    let left = runKwh;
    let cost = 0;
    for (const i of run) {
      const kwh = Math.min(left, fullKwh);
      cost += prices[i].price * kwh;
      left -= kwh;
    }
    return {
      startTime: prices[run[0]].startTime,
      endTime: prices[run[run.length - 1]].endTime,
      energyKwh: runKwh,
      cost,
    };
  });
  return { blocks, energyKwh, cost: sum(blocks.map((block) => block.cost)) };
}

/**
 * Whether a block runs at `now`, and when the plan next switches on or off.
 * nextChangeAt is undefined once the last block has ended.
 */
export function planState(
  plan: Plan,
  now: number,
): { activeNow: boolean; nextChangeAt?: string } {
  for (const block of plan.blocks) {
    if (now < Date.parse(block.startTime)) {
      return { activeNow: false, nextChangeAt: block.startTime };
    }
    if (now < Date.parse(block.endTime)) {
      return { activeNow: true, nextChangeAt: block.endTime };
    }
  }
  return { activeNow: false };
}
