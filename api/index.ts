import { NestFactory } from '@nestjs/core';
import { OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import {
  createOpenApiDocument,
  enablePublicCors,
  setupSwaggerUi,
} from '../src/app.setup';
import { VercelRequest, VercelResponse } from '@vercel/node';

let app: any;
let swaggerDocument: OpenAPIObject;

const createNestApp = async () => {
  if (!app) {
    app = await NestFactory.create(AppModule);

    enablePublicCors(app);
    swaggerDocument = createOpenApiDocument(app);
    setupSwaggerUi(app, swaggerDocument);

    await app.init();
  }
  return app;
};

export default async (req: VercelRequest, res: VercelResponse) => {
  // Handle OpenAPI JSON schema endpoint
  if (req.url === '/api-json' || req.url === '/api/json') {
    await createNestApp();

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
