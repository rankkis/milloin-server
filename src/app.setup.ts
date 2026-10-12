import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { RATE_LIMIT } from './shared/config/rate-limit.config';

export const CONTACT_EMAIL = 'jarkko.peltola@hurlumhei.xyz';
export const PUBLIC_API_URL = 'https://milloin.xyz/api';

// Matches the swagger-ui-dist that @nestjs/swagger installs
const SWAGGER_UI_CDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14';

const API_DESCRIPTION = `
Finnish electricity spot prices and the cheapest times to run a load, the same data that
powers [milloin.xyz](https://milloin.xyz).

- \`GET /v1/prices\`: prices from a time to a time, with the price now. \`/v1/prices/current\` for just the price now.
- \`GET /v1/plans\`: when to run a load, continuous (a washing machine) or pausable (an EV charger), with
  \`activeNow\` for switching a device. Ready-made loads at \`/v1/plans/presets\`.
- \`GET /v1/health\`: whether the prices are fresh and when tomorrow's arrive.

Prices come from the day-ahead market (ENTSO-E Transparency Platform, spot-hinta.fi as fallback) in
15-minute resolution, in c/kWh including 25.5 % VAT. Money is in cents, energy in kWh, power in kW. Times
are UTC (ISO 8601); requests may also give a UTC offset. Errors are \`application/problem+json\`.
The routes outside \`/v1\` are deprecated and stop answering on 31 December 2026.
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
    .addTag('prices', 'Spot prices: the price now and from a time to a time')
    .addTag(
      'plans',
      'When to run a load: continuous or pausable, presets or your own parameters',
    )
    .addTag('health', 'Whether the prices are fresh')
    .addTag('overview', 'Current price, upcoming prices and averages')
    .addTag(
      'optimal-window',
      'The cheapest times to run a task: presets or your own parameters',
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
