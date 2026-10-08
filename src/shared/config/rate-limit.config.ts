import { ExecutionContext } from '@nestjs/common';
import { ThrottlerModuleOptions } from '@nestjs/throttler';
import { timingSafeEqual } from 'crypto';

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

/**
 * milloin-web's server-side rendering calls the API from Vercel's IPs on
 * behalf of every visitor, so it is not limited. It proves itself with
 * the shared secret in SSR_API_KEY, set on both Vercel projects.
 */
export const SSR_KEY_HEADER = 'x-milloin-ssr-key';

const isSsrRequest = (context: ExecutionContext): boolean => {
  const expected = process.env.SSR_API_KEY;
  const given = context.switchToHttp().getRequest().headers?.[SSR_KEY_HEADER];
  if (!expected || typeof given !== 'string') {
    return false;
  }
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
};

export const RATE_LIMIT_OPTIONS: ThrottlerModuleOptions = {
  throttlers: [{ ttl: RATE_LIMIT.WINDOW_MS, limit: RATE_LIMIT.LIMIT }],
  getTracker: clientIp,
  skipIf: isSsrRequest,
};
