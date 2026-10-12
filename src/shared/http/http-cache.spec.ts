import { cacheControl, secondsToNextQuarter } from './http-cache';

describe('http cache', () => {
  it('counts the seconds to the next quarter hour', () => {
    expect(secondsToNextQuarter(Date.parse('2026-10-12T07:12:30Z'))).toBe(150);
    expect(secondsToNextQuarter(Date.parse('2026-10-12T07:15:00Z'))).toBe(900);
    expect(secondsToNextQuarter(Date.parse('2026-10-12T07:59:59.500Z'))).toBe(
      1,
    );
  });

  it('lets the CDN keep a response until the next quarter hour', () => {
    expect(cacheControl('quarter', Date.parse('2026-10-12T07:12:30Z'))).toBe(
      'public, max-age=60, s-maxage=150, stale-while-revalidate=60',
    );
  });

  it('keeps browsers from caching past the quarter hour', () => {
    expect(cacheControl('quarter', Date.parse('2026-10-12T07:14:30Z'))).toBe(
      'public, max-age=30, s-maxage=30, stale-while-revalidate=60',
    );
  });

  it('uses a fixed time when given', () => {
    expect(cacheControl(600, 0)).toBe(
      'public, max-age=60, s-maxage=600, stale-while-revalidate=60',
    );
    expect(cacheControl(0, 0)).toBe('no-store');
  });
});
