import { Transform } from 'class-transformer';

/**
 * A "+" in a query string decodes to a space, so a time with a UTC offset
 * written straight into a URL (08:00:00+03:00) arrives as "08:00:00 03:00".
 * This puts the plus back before the time is validated.
 */
export const RestoreOffsetPlus = () =>
  Transform(({ value }) =>
    typeof value === 'string'
      ? value.trim().replace(/ (\d{2}(:?\d{2})?)$/, '+$1')
      : value,
  );

export const TIME_FORMAT_NOTE =
  'ISO 8601 with Z or a UTC offset, for example 2026-10-13T08:00:00+03:00 (write + as %2B in a URL; a plain + is also understood). Responses are always in UTC (Z).';
