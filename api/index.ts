import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';
import { VercelRequest, VercelResponse } from '@vercel/node';

let app: any;

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
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
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

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document, {
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
  const nestApp = await createNestApp();
  const httpAdapter = nestApp.getHttpAdapter();
  const instance = httpAdapter.getInstance();

  return instance(req, res);
};