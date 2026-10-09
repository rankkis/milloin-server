import { ElectricityPriceDto } from '../shared/electricity-price/dto/electricity-price.dto';

/** Energy drawn in each price slot, in kWh, by index */
export type SlotEnergy = number[];

/** kWh drawn in a 15-minute slot at the given power */
export const quarterKwh = (powerKw: number): number => powerKw / 4;

/**
 * Number of 15-minute slots needed to draw energyKwh at maxPowerKw, and the
 * energy of the one slot that tops up the rest (equal to a full slot when
 * the energy divides evenly).
 */
export function slotsNeeded(
  energyKwh: number,
  maxPowerKw: number,
): { count: number; lastKwh: number } {
  const full = quarterKwh(maxPowerKw);
  const count = Math.max(1, Math.ceil(energyKwh / full - 1e-9));
  const lastKwh = Math.round((energyKwh - (count - 1) * full) * 1e6) / 1e6;
  return { count, lastKwh };
}

/**
 * The cheapest way to draw energyKwh from the given 15-minute prices at
 * most maxPowerKw, using blocks of at least minBlockSlots consecutive slots.
 * One slot may draw less than full power to top up the rest. Returns null
 * when the energy does not fit.
 *
 * Dynamic programming over the slots in time order. The state after a slot
 * is the number of slots used, the length of the running block (capped at
 * minBlockSlots, 0 when off) and whether the top-up slot is used. A block
 * may end only once it is long enough, and a gap in the prices ends it.
 */
export function planCheapestSchedule(
  prices: ElectricityPriceDto[],
  energyKwh: number,
  maxPowerKw: number,
  minBlockSlots = 1,
): SlotEnergy | null {
  const { count, lastKwh } = slotsNeeded(energyKwh, maxPowerKw);
  if (count > prices.length) return null;
  const fullKwh = quarterKwh(maxPowerKw);
  // A schedule shorter than the minimum block is one block of its own length
  const minBlock = Math.max(1, Math.min(minBlockSlots, count));

  const runs = minBlock + 1;
  const stateCount = (count + 1) * runs * 2;
  const index = (used: number, run: number, topUp: number) =>
    (used * runs + run) * 2 + topUp;

  let cost = new Float64Array(stateCount).fill(Infinity);
  let next = new Float64Array(stateCount);
  cost[index(0, 0, 0)] = 0;
  // Previous state of each state after each slot, for walking back
  const previous = new Int32Array(prices.length * stateCount).fill(-1);
  const ON_TOP_UP = 1 << 30;

  for (let i = 0; i < prices.length; i++) {
    next.fill(Infinity);
    const cents = prices[i].price * 100;
    const gap =
      i > 0 &&
      Date.parse(prices[i - 1].endDate) !== Date.parse(prices[i].startDate);
    const base = i * stateCount;

    for (let used = 0; used <= count; used++) {
      for (let run = 0; run < runs; run++) {
        for (let topUp = 0; topUp < 2; topUp++) {
          const from = index(used, run, topUp);
          const sofar = cost[from];
          if (sofar === Infinity) continue;
          // A short block cannot continue over a gap, nor end before it
          const mayEnd = run === 0 || run === minBlock;
          if (gap && !mayEnd) continue;
          const onRun = gap ? 1 : Math.min(run + 1, minBlock);

          const relax = (to: number, value: number, tag: number) => {
            if (value < next[to]) {
              next[to] = value;
              previous[base + to] = from | tag;
            }
          };
          if (mayEnd) relax(index(used, 0, topUp), sofar, 0);
          if (used < count) {
            relax(index(used + 1, onRun, topUp), sofar + cents * fullKwh, 0);
            if (!topUp) {
              relax(
                index(used + 1, onRun, 1),
                sofar + cents * lastKwh,
                ON_TOP_UP,
              );
            }
          }
        }
      }
    }
    [cost, next] = [next, cost];
  }

  const ends = [index(count, 0, 1), index(count, minBlock, 1)];
  let state = cost[ends[0]] <= cost[ends[1]] ? ends[0] : ends[1];
  if (cost[state] === Infinity) return null;

  const energy: SlotEnergy = new Array(prices.length).fill(0);
  for (let i = prices.length - 1; i >= 0; i--) {
    const link = previous[i * stateCount + state];
    const from = link & ~ON_TOP_UP;
    const usedNow = Math.floor(state / (runs * 2));
    const usedBefore = Math.floor(from / (runs * 2));
    if (usedNow > usedBefore) {
      energy[i] = link & ON_TOP_UP ? lastKwh : fullKwh;
    }
    state = from;
  }
  return energy;
}
