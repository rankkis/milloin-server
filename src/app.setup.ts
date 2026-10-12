import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { RATE_LIMIT } from './shared/config/rate-limit.config';

export const CONTACT_EMAIL = 'jarkko.peltola@hurlumhei.xyz';
export const PUBLIC_API_URL = 'https://milloin.xyz/api';

// Matches the swagger-ui-dist that @nestjs/swagger installs
const SWAGGER_UI_CDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14';

const API_DESCRIPTION = `
The data that powers [milloin.xyz](https://milloin.xyz), by category: Finnish electricity spot prices and
the cheapest times to run a load, and other things that happen.

Electricity, \`/v1/electricity\`:
- \`GET /v1/electricity/prices\`: prices from a time to a time, with the price now. \`/v1/electricity/prices/current\`
  for just the price now.
- \`GET /v1/electricity/plans\`: when to run a load, continuous (a washing machine) or pausable (an EV charger),
  with \`activeNow\` for switching a device. Ready-made loads at \`/v1/electricity/plans/presets\`.
- \`GET /v1/electricity/health\`: whether the prices are fresh and when tomorrow's arrive.

Miscellaneous, \`/v1/misc\`:
- \`GET /v1/misc/ence\`: the next Counter-Strike match of ENCE, the Finnish CS2 team, with streams, results and news.

Prices come from the day-ahead market (ENTSO-E Transparency Platform, spot-hinta.fi as fallback) in
15-minute resolution, in c/kWh including 25.5 % VAT. Money is in cents, energy in kWh, power in kW. Times
are UTC (ISO 8601); requests may also give a UTC offset. Errors are \`application/problem+json\`.
The OpenAPI document is at [milloin.xyz/api/openapi.json](https://milloin.xyz/api/openapi.json).
Guides, Home Assistant examples included, are at [milloin.xyz/docs](https://milloin.xyz/docs).

**Free to use.** No API key or sign-up is needed. GET responses carry \`Cache-Control\` up to the next
quarter hour, when the current price changes, and repeated requests are answered from the CDN. Requests
that reach the server count against a limit of ${RATE_LIMIT.LIMIT} per minute for each IP address; over
that the API answers 429 Too Many Requests with \`Retry-After\`. Day-ahead prices are published once a
day, around 14:00 Finnish time, so polling every few minutes is plenty. A link back to
[milloin.xyz](https://milloin.xyz) is appreciated.

**Business use.** For higher volumes, guaranteed availability or custom endpoints,
contact [${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL}).
`;

/** Paths before the categories, served until milloin-web has moved */
const PREVIOUS_PATHS: [string, string][] = [
  ['/v1/prices', '/v1/electricity/prices'],
  ['/v1/plans', '/v1/electricity/plans'],
  ['/v1/health', '/v1/electricity/health'],
  ['/ence', '/v1/misc/ence'],
];

/** Answers the paths before the categories as the new ones, outside the OpenAPI document */
export function servePreviousPaths(app: INestApplication): void {
  app.use((req: { url: string }, _res: unknown, next: () => void) => {
    const previous = PREVIOUS_PATHS.find(
      ([from]) =>
        req.url === from ||
        req.url.startsWith(`${from}/`) ||
        req.url.startsWith(`${from}?`),
    );
    if (previous) {
      req.url = previous[1] + req.url.slice(previous[0].length);
    }
    next();
  });
}

/**
 * The public API: any origin may call it from a browser. No endpoint
 * uses cookies or other credentials, so a wildcard origin is safe.
 */
export function enablePublicCors(app: INestApplication): void {
  app.enableCors({
    origin: '*',
    methods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'Retry-After',
    ],
    maxAge: 86400, // 24 hours preflight cache
  });
}

export function createOpenApiDocument(
  app: INestApplication,
  extraServers: { url: string; description: string }[] = [],
): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle('Milloin API')
    .setDescription(API_DESCRIPTION)
    .setVersion('1.0')
    .setContact('Milloin', 'https://milloin.xyz', CONTACT_EMAIL)
    .addTag(
      'prices',
      'Electricity spot prices: the price now and from a time to a time',
    )
    .addTag(
      'plans',
      'When to run an electric load: continuous or pausable, presets or your own parameters',
    )
    .addTag('health', 'Whether the electricity prices are fresh')
    .addTag(
      'ence',
      "ENCE's next Counter-Strike match, streams, results and news",
    )
    .addServer(PUBLIC_API_URL, 'Production');
  extraServers.forEach((server) =>
    builder.addServer(server.url, server.description),
  );
  return SwaggerModule.createDocument(app, builder.build(), {
    // Generated clients name operations after the method: getPrices
    operationIdFactory: (_controller: string, method: string) => method,
  });
}

/**
 * Swagger UI at /api. Its assets load from a CDN because Vercel's
 * serverless function cannot serve them from node_modules; the page
 * and its init script stay on this server.
 */
export function setupSwaggerUi(
  app: INestApplication,
  document: OpenAPIObject,
): void {
  SwaggerModule.setup('api', app, document, {
    customSiteTitle: 'Milloin API',
    customfavIcon: 'https://milloin.xyz/favicon.ico',
    customCssUrl: `${SWAGGER_UI_CDN}/swagger-ui.css`,
    customJs: [
      `${SWAGGER_UI_CDN}/swagger-ui-bundle.js`,
      `${SWAGGER_UI_CDN}/swagger-ui-standalone-preset.js`,
    ],
  });
}
