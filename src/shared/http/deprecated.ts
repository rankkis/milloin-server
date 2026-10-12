import { Header, applyDecorators } from '@nestjs/common';

/** Where the public API is served; Link targets are absolute so they work there too */
const PUBLIC_API_URL = 'https://milloin.xyz/api';

/** When the routes before /v1 were deprecated (RFC 9745) */
const DEPRECATED_AT = '@1791763200'; // 2026-10-12
/** When they stop answering (RFC 8594) */
export const SUNSET = 'Thu, 31 Dec 2026 00:00:00 GMT';

/**
 * Marks a route before /v1 as deprecated: Deprecation and Sunset headers,
 * and a Link to the route that replaces it.
 */
export const Deprecated = (successor: string) =>
  applyDecorators(
    Header('Deprecation', DEPRECATED_AT),
    Header('Sunset', SUNSET),
    Header('Link', `<${PUBLIC_API_URL}${successor}>; rel="successor-version"`),
  );
