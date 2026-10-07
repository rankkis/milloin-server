const HELSINKI_TIME_ZONE = 'Europe/Helsinki';

const helsinkiFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: HELSINKI_TIME_ZONE,
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  hourCycle: 'h23',
});

export interface HelsinkiParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

/**
 * Wall-clock date and time in Finland for the given instant.
 */
export function helsinkiParts(date: Date): HelsinkiParts {
  const parts = Object.fromEntries(
    helsinkiFormat
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)]),
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
  };
}

/**
 * The instant of midnight in Finland, `daysFromToday` days from the Finnish
 * date of `date`. Handles daylight saving time (UTC+2 / UTC+3).
 *
 * @example
 * // 2026-10-07T21:30Z is already Oct 8 in Finland
 * startOfHelsinkiDay(new Date('2026-10-07T21:30Z')) // 2026-10-07T21:00:00.000Z
 */
export function startOfHelsinkiDay(date: Date, daysFromToday = 0): Date {
  const { year, month, day } = helsinkiParts(date);
  const midnightAsUtc = Date.UTC(year, month - 1, day + daysFromToday);

  // Shift by Finland's UTC offset, checked again at the result in case the
  // offset differs there (daylight saving change).
  let result = midnightAsUtc - helsinkiOffsetMs(new Date(midnightAsUtc));
  result = midnightAsUtc - helsinkiOffsetMs(new Date(result));
  return new Date(result);
}

function helsinkiOffsetMs(date: Date): number {
  const { year, month, day, hour, minute } = helsinkiParts(date);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  return wallClockAsUtc - Math.floor(date.getTime() / 60000) * 60000;
}
