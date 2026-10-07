import { helsinkiParts, startOfHelsinkiDay } from './helsinki-time.helper';

describe('helsinki-time helper', () => {
  it('reads the Finnish wall-clock time', () => {
    expect(helsinkiParts(new Date('2026-10-07T21:30Z'))).toEqual({
      year: 2026,
      month: 10,
      day: 8,
      hour: 0,
      minute: 30,
    });
  });

  it.each([
    // Summer time, UTC+3
    ['2026-10-07T12:00Z', 0, '2026-10-06T21:00:00.000Z'],
    ['2026-10-07T21:30Z', 0, '2026-10-07T21:00:00.000Z'],
    ['2026-10-07T12:00Z', 1, '2026-10-07T21:00:00.000Z'],
    // Winter time, UTC+2
    ['2026-12-01T12:00Z', 0, '2026-11-30T22:00:00.000Z'],
    // Across the change to winter time on 2026-10-25
    ['2026-10-24T12:00Z', 1, '2026-10-24T21:00:00.000Z'],
    ['2026-10-24T12:00Z', 2, '2026-10-25T22:00:00.000Z'],
    // Across the change to summer time on 2026-03-29
    ['2026-03-28T12:00Z', 1, '2026-03-28T22:00:00.000Z'],
    ['2026-03-28T12:00Z', 2, '2026-03-29T21:00:00.000Z'],
  ])('startOfHelsinkiDay(%s, %i) is %s', (now, days, expected) => {
    expect(startOfHelsinkiDay(new Date(now), days).toISOString()).toBe(
      expected,
    );
  });
});
