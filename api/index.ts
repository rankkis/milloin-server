import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { VercelRequest, VercelResponse } from '@vercel/node';

let app: any;
let swaggerDocument: any;

const createNestApp = async () => {
  if (!app) {
    app = await NestFactory.create(AppModule);

    // Enable CORS for production
    app.enableCors({
      origin: [
        'https://milloin.xyz',
        'https://www.milloin.xyz',
        'https://milloin-web.vercel.app',
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'Accept',
        'Accept-Language',
        'Accept-Encoding',
        'User-Agent',
        'Referer',
        'Origin',
        'X-Requested-With',
        'cache-control',
        'Cache-Control',
        'pragma',
        'Pragma',
      ],
      exposedHeaders: ['Content-Type', 'Content-Length', 'Date'],
      credentials: true,
      maxAge: 86400, // 24 hours preflight cache
      preflightContinue: false,
    });

    // Swagger configuration for production
    const config = new DocumentBuilder()
      .setTitle('Milloin Server API')
      .setDescription(
        'Backend service for optimal electricity usage timing in Finland. ' +
        'This API helps users determine the cheapest times to run appliances like washing machines ' +
        'based on real-time Finnish electricity spot prices from Nord Pool via spot-hinta.fi API.'
      )
      .setVersion('1.0')
      .addTag('washing-machine', 'Washing machine optimal timing endpoints')
      .build();

    swaggerDocument = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, swaggerDocument, {
      customSiteTitle: 'Milloin Server API Documentation',
      swaggerOptions: {
        persistAuthorization: true,
      },
      customCssUrl: 'https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui.css',
      customJs: [
        'https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-bundle.js',
        'https://unpkg.com/swagger-ui-dist@4.15.5/swagger-ui-standalone-preset.js',
      ],
    });

    await app.init();
  }
  return app;
};

export default async (req: VercelRequest, res: VercelResponse) => {
  // Handle OpenAPI JSON schema endpoint
  if (req.url === '/api-json' || req.url === '/api/json') {
    const nestApp = await createNestApp();

    // Set CORS headers for JSON schema
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Content-Type', 'application/json');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    // Return the OpenAPI JSON document
    return res.json(swaggerDocument);
  }

  const nestApp = await createNestApp();
  const httpAdapter = nestApp.getHttpAdapter();
  const instance = httpAdapter.getInstance();

  return instance(req, res);
};