/**
 * Calculate TTL (Time To Live) in milliseconds until the next 15-minute interval.
 * Intervals are at :00, :15, :30, and :45 minutes of each hour.
 *
 * @returns TTL in milliseconds
 *
 * @example
 * // Current time: 13:12:30
 * // Next interval: 13:15:00
 * // Returns: 150000 (2.5 minutes in milliseconds)
 */
export function calculateCacheTtl(): number {
  const now = new Date();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const milliseconds = now.getMilliseconds();

  // Calculate next 15-minute interval (0, 15, 30, 45)
  const nextInterval = Math.ceil((minutes + 1) / 15) * 15;

  // Calculate minutes until next interval
  const minutesUntilNext = nextInterval > 60 ? 60 - minutes : nextInterval - minutes;

  // Convert to milliseconds and subtract current seconds/milliseconds
  const ttl = minutesUntilNext * 60 * 1000 - seconds * 1000 - milliseconds;

  // Ensure minimum TTL of 1 second
  return Math.max(1000, ttl);
}
