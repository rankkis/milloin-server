import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { Observable, catchError, tap, throwError } from 'rxjs';

const QUARTER_MS = 15 * 60 * 1000;

/** Longest time a browser keeps a response before asking again */
const BROWSER_MAX_AGE_SECONDS = 60;

/**
 * How long the CDN may serve an expired response while it fetches a new one
 * in the background. Short, so the current price is at most this late after
 * a quarter changes.
 */
const STALE_WHILE_REVALIDATE_SECONDS = 60;

/**
 * Seconds a GET response may be cached: 'quarter' up to the next quarter
 * hour (:00, :15, :30, :45), when prices change; a number for a fixed time;
 * 0 for not at all.
 */
export type HttpCacheTtl = 'quarter' | number;

const HTTP_CACHE_TTL = 'httpCacheTtl';

/**
 * Sets how long GET responses of a route or controller may be cached by
 * browsers and the CDN. GET routes without it are cached until the next
 * quarter hour.
 */
export const HttpCache = (ttl: HttpCacheTtl) =>
  SetMetadata(HTTP_CACHE_TTL, ttl);

/** Seconds from `now` to the next quarter hour, at least 1 */
export function secondsToNextQuarter(now: number): number {
  const next = (Math.floor(now / QUARTER_MS) + 1) * QUARTER_MS;
  return Math.max(1, Math.ceil((next - now) / 1000));
}

export function cacheControl(ttl: HttpCacheTtl, now: number): string {
  const seconds = ttl === 'quarter' ? secondsToNextQuarter(now) : ttl;
  if (seconds <= 0) {
    return 'no-store';
  }
  const maxAge = Math.min(BROWSER_MAX_AGE_SECONDS, seconds);
  return `public, max-age=${maxAge}, s-maxage=${seconds}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`;
}

/**
 * Adds Cache-Control to successful GET responses, so Vercel's CDN answers
 * repeated requests without running the function, and no-store to errors so
 * a failure is not cached. Responses that already set Cache-Control keep it.
 */
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const method = http.getRequest().method;
    const response = http.getResponse<Response>();
    if (method !== 'GET' && method !== 'HEAD') {
      return next.handle();
    }

    const ttl =
      this.reflector.getAllAndOverride<HttpCacheTtl>(HTTP_CACHE_TTL, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'quarter';

    return next.handle().pipe(
      tap(() => {
        if (!response.headersSent && !response.getHeader('Cache-Control')) {
          response.setHeader('Cache-Control', cacheControl(ttl, Date.now()));
        }
      }),
      catchError((error) => {
        if (!response.headersSent) {
          response.setHeader('Cache-Control', 'no-store');
        }
        return throwError(() => error);
      }),
    );
  }
}
