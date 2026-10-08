import { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Requests one client (IP address) may make per window. The site itself
 * makes a few requests per page view, so only scripts reach this.
 */
export const RATE_LIMIT = {
  LIMIT: 60,
  WINDOW_MS: 60 * 1000,
};

/**
 * Vercel puts the client's address first in X-Forwarded-For; the socket
 * address is Vercel's own.
 */
const clientIp = (req: Record<string, any>): string => {
  const forwardedFor = req.headers?.['x-forwarded-for'];
  const first = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  return first?.split(',')[0].trim() || req.ip;
};

export const RATE_LIMIT_OPTIONS: ThrottlerModuleOptions = {
  throttlers: [{ ttl: RATE_LIMIT.WINDOW_MS, limit: RATE_LIMIT.LIMIT }],
  getTracker: clientIp,
};
