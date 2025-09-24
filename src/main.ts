import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for all environments
  app.enableCors({
    origin: true, // Allow all origins in development
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // Only configure Swagger and listen to port in non-Vercel environments
  if (!process.env.VERCEL) {
    // Swagger configuration
    const config = new DocumentBuilder()
      .setTitle('Milloin Server API')
      .setDescription(
        'Backend service for optimal electricity usage timing in Finland. ' +
          'This API helps users determine the cheapest times to run appliances like washing machines ' +
          'based on real-time Finnish electricity spot prices from Nord Pool via spot-hinta.fi API.',
      )
      .setVersion('1.0')
      .addTag('washing-machine', 'Washing machine optimal timing endpoints')
      .addServer('http://localhost:3000', 'Development server')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document, {
      customSiteTitle: 'Milloin Server API Documentation',
      customfavIcon: '/favicon.ico',
      customCssUrl: '/swagger-ui-custom.css',
    });

    await app.listen(process.env.PORT ?? 3000);
    console.log(
      `Application is running on: http://localhost:${process.env.PORT ?? 3000}`,
    );
    console.log(
      `Swagger documentation available at: http://localhost:${process.env.PORT ?? 3000}/api`,
    );
  } else {
    // For Vercel deployment, just initialize the app
    await app.init();
  }
}
bootstrap();
