import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { RATE_LIMIT } from './shared/config/rate-limit.config';

export const CONTACT_EMAIL = 'jarkko.peltola@hurlumhei.xyz';
export const PUBLIC_API_URL = 'https://milloin.xyz/api';

// Matches the swagger-ui-dist that @nestjs/swagger installs
const SWAGGER_UI_CDN = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14';

const API_DESCRIPTION = `
Finnish electricity spot prices and the cheapest times to run high-consumption tasks,
the same data that powers [milloin.xyz](https://milloin.xyz).

Prices come from the day-ahead market (ENTSO-E Transparency Platform), in 15-minute
resolution, in c/kWh including 25.5 % VAT. Times are UTC (ISO 8601, zulu time).
The OpenAPI document is at [milloin.xyz/api/openapi.json](https://milloin.xyz/api/openapi.json).

**Free to use.** No API key or sign-up is needed. Each IP address may make
${RATE_LIMIT.LIMIT} requests per minute; over that the API answers 429 Too Many Requests
until the minute is up. Please cache responses on your side: day-ahead prices are published once a day, around 14:00
Finnish time. A link back to [milloin.xyz](https://milloin.xyz) is appreciated.

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
    .addTag('overview', 'Current price, upcoming prices and averages')
    .addTag(
      'optimal-window',
      'The cheapest times to run a task: presets or your own parameters',
    )
    .addTag(
      'wash-laundry',
      'Deprecated: use /optimal-window/presets/wash-laundry',
    )
    .addTag('charge-ev', 'Deprecated: use /optimal-window/presets/charge-ev')
    .addServer(PUBLIC_API_URL, 'Production');
  extraServers.forEach((server) =>
    builder.addServer(server.url, server.description),
  );
  return SwaggerModule.createDocument(app, builder.build());
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
